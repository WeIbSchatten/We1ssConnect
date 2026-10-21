import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { alert } from '@/components/dialog';
import { UpdateCard } from '@/components/UpdateCard';
import { Button, Card, Muted, PingBadge, Stats } from '@/components/ui';
import { protocolLabel, serverAddress } from '@/lib/config';
import { countryName, formatBytes, formatDate, formatDuration, formatSpeed, t } from '@/lib/i18n';
import { flag, maskIp, useLive } from '@/lib/live';
import { allServers, getState, hasServers, isAuto, selectedServer, updateSettings, useStore } from '@/lib/store';
import { refreshStale } from '@/lib/subscription';
import { usePalette } from '@/lib/theme';
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

/** Slow breathing ring around the button while connecting or connected. */
function usePulse(running: boolean): Animated.Value {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!running) {
      value.stopAnimation();
      value.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [running, value]);
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

  const on = status.state === 'connected';
  const pending = status.state === 'connecting' || busy;
  const now = useNow(on);
  const pulse = usePulse(on || pending);

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

  async function toggle() {
    if (on || status.state === 'connecting') {
      disconnect();
      return;
    }
    setBusy(true);
    try {
      await connect();
    } catch (e) {
      alert(t('error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const info = profile?.userInfo;
  const used = info ? info.upload + info.download : 0;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.center}>
        <View style={styles.powerWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                borderColor: color,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
              },
            ]}
          />
          <Pressable
            onPress={toggle}
            disabled={!any || busy}
            accessibilityLabel={on ? t('disconnect') : t('connect')}
            style={({ pressed }) => [
              styles.power,
              {
                borderColor: color,
                backgroundColor: on ? p.accentSoft : p.surface,
                opacity: !any ? 0.4 : pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}>
            {pending ? (
              <ActivityIndicator size="large" color={p.warning} />
            ) : (
              <Ionicons name="power" size={68} color={on ? p.success : p.text} />
            )}
          </Pressable>
        </View>
        <Text style={[styles.state, { color }]}>{label}</Text>
        {on && live.connectedAt ? (
          <Muted>{t('duration', { time: formatDuration(now - live.connectedAt) })}</Muted>
        ) : null}
        {status.state === 'error' && status.error ? <Muted>{status.error}</Muted> : null}
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  center: { alignItems: 'center', marginTop: 28, marginBottom: 32, gap: 10 },
  powerWrap: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 176, height: 176, borderRadius: 88, borderWidth: 3 },
  power: {
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  state: { fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '600' },
  flag: { fontSize: 36 },
  ipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  ip: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bar: { height: 6, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
});
