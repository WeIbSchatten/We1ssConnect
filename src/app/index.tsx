import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Muted } from '@/components/ui';
import { protocolLabel, serverAddress } from '@/lib/config';
import { formatBytes, formatDate, t } from '@/lib/i18n';
import { selectedServer, useStore } from '@/lib/store';
import { usePalette } from '@/lib/theme';
import { connect, disconnect, useVpnStatus } from '@/lib/vpn';

export default function Home() {
  const p = usePalette();
  const status = useVpnStatus();
  const server = useStore((s) => selectedServer(s));
  const profile = useStore((s) => s.profiles.find((x) => x.servers.some((y) => y.id === server?.id)));
  const [busy, setBusy] = useState(false);

  const on = status.state === 'connected';
  const pending = status.state === 'connecting' || busy;
  const color = on ? p.success : status.state === 'error' ? p.error : p.text3;
  const label =
    status.state === 'connected'
      ? t('connected')
      : status.state === 'connecting'
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
      Alert.alert(t('error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const info = profile?.userInfo;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable hitSlop={12}>
                <Ionicons name="settings-outline" size={22} color={p.text} />
              </Pressable>
            </Link>
          ),
        }}
      />

      <View style={styles.center}>
        <Pressable
          onPress={toggle}
          disabled={!server || busy}
          style={({ pressed }) => [
            styles.power,
            {
              borderColor: color,
              backgroundColor: on ? p.accentSoft : p.surface,
              opacity: !server ? 0.4 : pressed ? 0.8 : 1,
            },
          ]}>
          {pending ? (
            <ActivityIndicator size="large" color={p.accent} />
          ) : (
            <Ionicons name="power" size={64} color={on ? p.success : p.text} />
          )}
        </Pressable>
        <Text style={[styles.state, { color }]}>{label}</Text>
        {status.state === 'error' && status.error ? <Muted>{status.error}</Muted> : null}
      </View>

      {server ? (
        <Pressable onPress={() => router.push('/servers')}>
          <Card style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: p.text }]} numberOfLines={1}>
                {server.name}
              </Text>
              <Muted>
                {protocolLabel(server.outbound)} · {serverAddress(server.outbound)}
              </Muted>
            </View>
            <Ionicons name="chevron-forward" size={20} color={p.text3} />
          </Card>
        </Pressable>
      ) : (
        <Card>
          <Text style={[styles.name, { color: p.text, marginBottom: 6 }]}>{t('noServers')}</Text>
          <Muted>{t('noServersHint')}</Muted>
          <View style={{ height: 12 }} />
          <Button title={t('addServers')} onPress={() => router.push('/add')} />
        </Card>
      )}

      {profile && info ? (
        <Card style={{ marginTop: 12 }}>
          <Text style={[styles.name, { color: p.text, marginBottom: 4 }]}>{profile.name}</Text>
          <Muted>
            {info.total > 0
              ? t('traffic', { used: formatBytes(info.upload + info.download), total: formatBytes(info.total) })
              : t('trafficUnlimited', { used: formatBytes(info.upload + info.download) })}
          </Muted>
          {info.expire > 0 ? <Muted>{t('expires', { date: formatDate(info.expire * 1000) })}</Muted> : null}
          {info.total > 0 ? (
            <View style={[styles.bar, { backgroundColor: p.surface2 }]}>
              <View
                style={{
                  width: `${Math.min(100, ((info.upload + info.download) / info.total) * 100)}%`,
                  backgroundColor: p.accent,
                  height: '100%',
                  borderRadius: 3,
                }}
              />
            </View>
          ) : null}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  center: { alignItems: 'center', marginVertical: 40, gap: 12 },
  power: {
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  state: { fontSize: 18, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '600' },
  bar: { height: 6, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
});
