import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Muted } from '@/components/ui';
import { protocolLabel, serverAddress } from '@/lib/config';
import { formatDate, t } from '@/lib/i18n';
import { removeProfile, selectServer, selectedServer, useStore } from '@/lib/store';
import { refreshAll } from '@/lib/subscription';
import { usePalette } from '@/lib/theme';
import { connect, pingAll, useVpnStatus } from '@/lib/vpn';

export default function Servers() {
  const p = usePalette();
  const profiles = useStore((s) => s.profiles);
  const current = useStore((s) => selectedServer(s)?.id);
  const status = useVpnStatus();
  const [refreshing, setRefreshing] = useState(false);
  const [pinging, setPinging] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refreshAll();
    } catch (e) {
      Alert.alert(t('refresh'), (e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  async function onPing() {
    setPinging(true);
    try {
      await pingAll();
    } catch (e) {
      Alert.alert(t('ping'), (e as Error).message);
    } finally {
      setPinging(false);
    }
  }

  function choose(id: string) {
    selectServer(id);
    if (status.state === 'connected') connect().catch((e) => Alert.alert(t('error'), (e as Error).message));
    router.back();
  }

  function confirmRemove(id: string, name: string) {
    Alert.alert(t('remove'), t('removeConfirm', { name }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('remove'), style: 'destructive', onPress: () => removeProfile(id) },
    ]);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable hitSlop={12} onPress={() => router.push('/add')}>
              <Ionicons name="add" size={26} color={p.text} />
            </Pressable>
          ),
        }}
      />
      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button title={t('ping')} kind="secondary" onPress={onPing} disabled={pinging} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t('refresh')} kind="secondary" onPress={onRefresh} disabled={refreshing} />
        </View>
      </View>

      {profiles.map((profile) => (
        <View key={profile.id} style={{ marginBottom: 18 }}>
          <Pressable onLongPress={() => confirmRemove(profile.id, profile.name)} style={styles.header}>
            <Text style={[styles.group, { color: p.text2 }]}>{profile.name}</Text>
            {profile.url ? <Muted>{t('updated', { date: formatDate(profile.updatedAt) })}</Muted> : null}
          </Pressable>
          <Card style={{ padding: 0 }}>
            {profile.servers.map((server, i) => {
              const active = server.id === current;
              const ping = server.ping;
              return (
                <Pressable
                  key={server.id}
                  onPress={() => choose(server.id)}
                  style={[
                    styles.row,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border },
                  ]}>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? p.accent : p.text3}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.text, fontSize: 15, fontWeight: '500' }} numberOfLines={1}>
                      {server.name}
                    </Text>
                    <Muted>
                      {protocolLabel(server.outbound)} · {serverAddress(server.outbound)}
                    </Muted>
                  </View>
                  {ping !== undefined ? (
                    <Text
                      style={{
                        color: ping < 0 ? p.error : ping < 300 ? p.success : p.warning,
                        fontVariant: ['tabular-nums'],
                      }}>
                      {ping < 0 ? '—' : `${ping} ms`}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </Card>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 4 },
  group: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
});
