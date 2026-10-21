import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { alert } from '@/components/dialog';
import { Button, Card, Muted, PingBadge, Segmented } from '@/components/ui';
import { protocolLabel, serverAddress } from '@/lib/config';
import { formatDate, t } from '@/lib/i18n';
import { lookupIp, useLive } from '@/lib/live';
import {
  allServers,
  isAuto,
  removeServer,
  selectServer,
  selectedServer,
  updateSettings,
  useStore,
} from '@/lib/store';
import { refreshAll, shareLink } from '@/lib/subscription';
import { usePalette } from '@/lib/theme';
import { AUTO_ID, type BalancerStrategy, type Server } from '@/lib/types';
import { applySelection, autoPing, pingAll, reconnectIfActive, useVpnStatus } from '@/lib/vpn';

/** Unknown delays last, timeouts after the answering ones. */
function byPing(a: number | undefined, b: number | undefined): number {
  const rank = (x: number | undefined) => (x === undefined ? 1e9 : x < 0 ? 1e8 : x);
  return rank(a) - rank(b);
}

export default function Servers() {
  const p = usePalette();
  const profiles = useStore((s) => s.profiles);
  const auto = useStore((s) => isAuto(s));
  const current = useStore((s) => selectedServer(s)?.id);
  const status = useVpnStatus();
  const livePings = useLive((l) => l.pings);
  const activeId = useLive((l) => l.activeId);
  const balancer = useStore((s) => s.settings.balancer);
  const roundRobin = balancer === 'roundRobin';
  // A test through the servers needs the tunnel down; a direct one does not.
  const fullPing = useStore((s) => s.settings.pingMode === 'full');
  const [refreshing, setRefreshing] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [sorted, setSorted] = useState(false);
  const on = status.state === 'connected';

  useFocusEffect(useCallback(() => autoPing(), []));

  const pingOf = (s: Server) => (on ? (livePings[s.id] ?? s.ping) : s.ping);
  const active = auto && on && !roundRobin ? allServers().find((s) => s.id === activeId) : undefined;

  function setBalancer(v: BalancerStrategy) {
    updateSettings({ balancer: v });
    if (auto) reconnectIfActive().catch((e) => alert(t('error'), (e as Error).message));
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refreshAll();
    } catch (e) {
      alert(t('refresh'), (e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  async function onPing() {
    setPinging(true);
    try {
      await pingAll();
    } catch (e) {
      alert(t('ping'), (e as Error).message);
    } finally {
      setPinging(false);
    }
  }

  function choose(id: string) {
    selectServer(id);
    // The running tunnel already has every server; only the balancer target moves.
    applySelection()
      .then(() => (on ? lookupIp() : undefined))
      .catch((e) => alert(t('error'), (e as Error).message));
  }

  function serverActions(server: Server) {
    alert(server.name, `${protocolLabel(server.outbound)} · ${serverAddress(server.outbound)}`, [
      {
        text: t('copyLink'),
        onPress: () =>
          shareLink(server)
            .then((link) => Clipboard.setStringAsync(link))
            .then(() => alert(t('copied')))
            .catch((e) => alert(t('error'), (e as Error).message)),
      },
      { text: t('remove'), style: 'destructive', onPress: () => removeServer(server.id) },
      { text: t('cancel'), style: 'cancel' },
    ]);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button
            title={pinging ? t('pinging') : t('ping')}
            icon="speedometer-outline"
            kind="secondary"
            onPress={onPing}
            disabled={pinging || (on && fullPing)}
          />
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => setSorted((v) => !v)}
          accessibilityLabel={t('sortByPing')}
          style={[styles.square, { backgroundColor: sorted ? p.accentSoft : p.surface2 }]}>
          <Ionicons name="swap-vertical" size={20} color={sorted ? p.accent : p.text} />
        </Pressable>
        <Pressable
          hitSlop={8}
          onPress={onRefresh}
          accessibilityLabel={t('refresh')}
          style={[styles.square, { backgroundColor: p.surface2 }]}>
          <Ionicons name="refresh" size={20} color={p.text} />
        </Pressable>
        <Pressable
          hitSlop={8}
          onPress={() => router.push('/add')}
          accessibilityLabel={t('add')}
          style={[styles.square, { backgroundColor: p.accent }]}>
          <Ionicons name="add" size={22} color={p.onAccent} />
        </Pressable>
      </View>

      {profiles.length === 0 ? (
        <Card>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '600', marginBottom: 6 }}>{t('noServers')}</Text>
          <Muted>{t('noServersHint')}</Muted>
        </Card>
      ) : (
        <Card style={{ padding: 0, marginBottom: 18 }}>
          <Pressable onPress={() => choose(AUTO_ID)} style={styles.row}>
            <Ionicons
              name={auto ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={auto ? p.accent : p.text3}
            />
            <View style={[styles.icon, { backgroundColor: p.accentSoft }]}>
              <Ionicons name="flash" size={16} color={p.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: p.text }]}>{roundRobin ? t('autoRoundRobin') : t('auto')}</Text>
              <Muted numberOfLines={2}>
                {roundRobin ? t('roundRobinHint') : active ? t('autoNow', { name: active.name }) : t('autoHint')}
              </Muted>
            </View>
            {active ? <PingBadge ping={pingOf(active)} /> : null}
          </Pressable>
          <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
            <Segmented<BalancerStrategy>
              value={balancer}
              onChange={setBalancer}
              options={[
                { value: 'leastPing', label: t('balancerLeastPing') },
                { value: 'roundRobin', label: t('balancerRoundRobin') },
              ]}
            />
          </View>
        </Card>
      )}

      {profiles.map((profile) => {
        const servers = sorted
          ? [...profile.servers].sort((a, b) => byPing(pingOf(a), pingOf(b)))
          : profile.servers;
        return (
          <View key={profile.id} style={{ marginBottom: 18 }}>
            <Pressable onPress={() => router.push({ pathname: '/profile', params: { id: profile.id } })} style={styles.header}>
              <Ionicons name={profile.url ? 'cloud-outline' : 'key-outline'} size={14} color={p.text2} />
              <Text style={[styles.group, { color: p.text2 }]} numberOfLines={1}>
                {profile.name}
              </Text>
              <View style={{ flex: 1 }} />
              {profile.url ? <Muted>{t('updated', { date: formatDate(profile.updatedAt) })}</Muted> : null}
              <Ionicons name="chevron-forward" size={16} color={p.text2} />
            </Pressable>
            <Card style={{ padding: 0 }}>
              {servers.map((server, i) => {
                const chosen = !auto && server.id === current;
                const inUse = auto && on && server.id === activeId;
                return (
                  <Pressable
                    key={server.id}
                    onPress={() => choose(server.id)}
                    onLongPress={() => serverActions(server)}
                    style={({ pressed }) => [
                      styles.row,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border },
                      pressed && { backgroundColor: p.surface2 },
                    ]}>
                    <Ionicons
                      name={chosen ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={chosen ? p.accent : p.text3}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, { color: p.text }]} numberOfLines={1}>
                        {inUse ? '⚡ ' : ''}
                        {server.name}
                      </Text>
                      <Muted numberOfLines={1}>
                        {protocolLabel(server.outbound)} · {serverAddress(server.outbound)}
                      </Muted>
                    </View>
                    <PingBadge ping={pingOf(server)} />
                  </Pressable>
                );
              })}
            </Card>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 18, alignItems: 'center' },
  square: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingHorizontal: 4, paddingVertical: 4 },
  group: { flexShrink: 1, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '500' },
});
