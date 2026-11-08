import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConnectOrb, type OrbState } from '@/components/ConnectOrb';
import { alert } from '@/components/dialog';
import { UpdateCard } from '@/components/UpdateCard';
import { Button, Card, Muted, PingBadge, Stats } from '@/components/ui';
import { protocolLabel, serverAddress } from '@/lib/config';
import { countryName, formatBytes, formatDate, formatDuration, formatSpeed, t } from '@/lib/i18n';
import { flag, maskIp, useLive } from '@/lib/live';
import { column, useHomeColumns } from '@/lib/layout';
import { allServers, getState, hasServers, isAuto, selectedServer, updateSettings, useStore } from '@/lib/store';
import { refreshStale } from '@/lib/subscription';
import { FONT, usePalette } from '@/lib/theme';
import { autoCheck } from '@/lib/updater';
import { autoPing, connect, disconnect, useVpnStatus } from '@/lib/vpn';

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** The state line slides in from below each time it changes, so a new state is noticed. */
function useEntrance(key: string): Animated.Value {
  const [value] = useState(() => new Animated.Value(1));
  useEffect(() => {
    value.setValue(0);
    Animated.timing(value, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [key, value]);
  return value;
}

export default function Home() {
  const p = usePalette();
  const status = useVpnStatus();
  const auto = useStore((s) => isAuto(s));
  const server = useStore((s) => selectedServer(s));
  const any = useStore((s) => hasServers(s));
  const profiles = useStore((s) => s.profiles);
  const live = useLive((l) => l);
  const fullIp = useStore((s) => s.settings.showFullIp);
  const roundRobin = useStore((s) => s.settings.balancer === 'roundRobin');
  const [busy, setBusy] = useState(false);
  const columns = useHomeColumns();

  const on = status.state === 'connected';
  const pending = status.state === 'connecting' || busy;
  const now = useNow(on);

  useEffect(() => {
    // New servers from a refresh get their delays tested right after.
    const refresh = getState().settings.autoUpdate ? refreshStale() : Promise.resolve();
    void refresh.finally(autoPing);
    autoCheck();
  }, []);

  // Round robin moves on with every connection, so there is no single server to show.
  const activeId = auto ? (roundRobin ? undefined : live.activeId) : server?.id;
  const active = activeId ? allServers().find((s) => s.id === activeId) : server;
  const shown = active ?? server;
  const ping = on && shown ? (live.pings[shown.id] ?? shown.ping) : shown?.ping;
  const profile = profiles.find((x) => x.servers.some((y) => y.id === shown?.id)) ?? profiles[0];

  const color = on ? p.success : status.state === 'error' ? p.error : pending ? p.warning : p.text3;
  const label = on
    ? t('connected')
    : pending
      ? t('connecting')
      : status.state === 'error'
        ? t('error')
        : t('disconnected');
  const entrance = useEntrance(label);
  const orb: OrbState = on ? 'on' : pending ? 'connecting' : status.state === 'error' ? 'error' : 'off';

  async function toggle() {
    if (on || status.state === 'connecting') {
      disconnect();
      return;
    }
    setBusy(true);
    try {
      const warning = await connect();
      if (warning) alert(t('warning'), warning);
    } catch (e) {
      alert(t('error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const info = profile?.userInfo;
  const used = info ? info.upload + info.download : 0;
  const hero = (
      <View style={styles.center}>
        <ConnectOrb
          state={orb}
          speed={on ? live.downSpeed + live.upSpeed : 0}
          disabled={!any || busy}
          onPress={toggle}
          label={on ? t('disconnect') : t('connect')}
        />
        <Animated.Text
          style={[
            styles.state,
            { color, opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
          ]}>
          {label}
        </Animated.Text>
        {on && live.connectedAt ? (
          <Muted>{t('duration', { time: formatDuration(now - live.connectedAt) })}</Muted>
        ) : null}
        {status.state === 'error' && status.error ? <Muted>{status.error}</Muted> : null}
      </View>

  );
  const cards = (
    <>
      <UpdateCard style={{ marginBottom: 12 }} />

      {any ? (
        <Pressable onPress={() => router.navigate('/servers')}>
          <Card style={styles.row}>
            <View style={[styles.icon, { backgroundColor: p.accentSoft }]}>
              <Ionicons name={auto ? 'flash' : 'server'} size={20} color={p.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: p.text }]} numberOfLines={1}>
                {auto ? (roundRobin ? t('autoRoundRobin') : t('auto')) : (shown?.name ?? '')}
              </Text>
              <Muted numberOfLines={1}>
                {auto
                  ? roundRobin
                    ? t('roundRobinHint')
                    : active
                      ? t('autoNow', { name: active.name })
                      : t('autoHint')
                  : shown
                    ? `${protocolLabel(shown.outbound)} · ${serverAddress(shown.outbound)}`
                    : ''}
              </Muted>
            </View>
            <PingBadge ping={ping} />
            <Ionicons name="chevron-forward" size={18} color={p.text3} />
          </Card>
        </Pressable>
      ) : (
        <Card>
          <Text style={[styles.name, { color: p.text, marginBottom: 6 }]}>{t('noServers')}</Text>
          <Muted>{t('noServersHint')}</Muted>
          <View style={{ height: 12 }} />
          <Button title={t('addServers')} icon="add" onPress={() => router.push('/add')} />
        </Card>
      )}

      {on ? (
        <Card style={[styles.row, { marginTop: 12 }]}>
          <Text style={styles.flag}>{flag(live.ip?.countryCode)}</Text>
          <View style={{ flex: 1 }}>
            <Muted>{t('yourIp')}</Muted>
            {live.ip ? (
              <>
                <Pressable onPress={() => updateSettings({ showFullIp: !fullIp })} style={styles.ipRow}>
                  <Text style={[styles.ip, { color: p.text }]}>{fullIp ? live.ip.ip : maskIp(live.ip.ip)}</Text>
                  <Ionicons name={fullIp ? 'eye-off-outline' : 'eye-outline'} size={16} color={p.text3} />
                </Pressable>
                <Muted numberOfLines={1}>
                  {[countryName(live.ip.countryCode, live.ip.country), live.ip.city, live.ip.isp]
                    .filter(Boolean)
                    .join(' · ')}
                </Muted>
              </>
            ) : (
              <Text style={{ color: p.text2, fontSize: 15, marginTop: 2 }}>
                {live.ipError ? t('ipFailed') : t('ipLoading')}
              </Text>
            )}
          </View>
        </Card>
      ) : null}

      {on ? (
        <View style={{ marginTop: 12 }}>
          <Stats
            items={[
              { label: `↓ ${t('download')}`, value: formatSpeed(live.downSpeed), color: p.success },
              { label: `↑ ${t('upload')}`, value: formatSpeed(live.upSpeed), color: p.info },
              { label: t('session'), value: formatBytes(live.downTotal + live.upTotal) },
            ]}
          />
        </View>
      ) : null}

      {profile && info ? (
        <Pressable onPress={() => router.push({ pathname: '/profile', params: { id: profile.id } })}>
          <Card style={{ marginTop: 12 }}>
            <Text style={[styles.name, { color: p.text, marginBottom: 4 }]}>{profile.name}</Text>
            <Muted>
              {info.total > 0
                ? t('traffic', { used: formatBytes(used), total: formatBytes(info.total) })
                : t('trafficUnlimited', { used: formatBytes(used) })}
            </Muted>
            {info.expire > 0 ? <Muted>{t('expires', { date: formatDate(info.expire * 1000) })}</Muted> : null}
            {info.total > 0 ? (
              <View style={[styles.bar, { backgroundColor: p.surface2 }]}>
                <View
                  style={{
                    width: `${Math.min(100, (used / info.total) * 100)}%`,
                    backgroundColor: used / info.total > 0.9 ? p.warning : p.accent,
                    height: '100%',
                    borderRadius: 3,
                  }}
                />
              </View>
            ) : null}
          </Card>
        </Pressable>
      ) : null}
    </>
  );
  if (columns === 2) {
    return (
      <View style={styles.split}>
        <View style={styles.splitHero}>{hero}</View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.splitCards}>
          {cards}
        </ScrollView>
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={[styles.page, column]}>
      {hero}
      {cards}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  split: { flex: 1, flexDirection: 'row' },
  splitHero: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  splitCards: { flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 560, alignSelf: 'center', padding: 16 },
  center: { alignItems: 'center', marginTop: 12, marginBottom: 28, gap: 6 },
  state: { fontSize: 26, fontFamily: FONT.semibold, letterSpacing: -0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontFamily: FONT.semibold },
  flag: { fontSize: 36 },
  ipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  ip: { fontSize: 18, fontFamily: FONT.semibold, fontVariant: ['tabular-nums'] },
  bar: { height: 6, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
});
