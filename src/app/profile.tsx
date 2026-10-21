import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { alert } from '@/components/dialog';
import { Button, Card, Muted, Row, SectionTitle } from '@/components/ui';
import { protocolLabel, serverAddress } from '@/lib/config';
import { formatBytes, formatDate, t } from '@/lib/i18n';
import { openLink } from '@/lib/links';
import { removeProfile, useStore } from '@/lib/store';
import { refreshProfile, telegramLabel } from '@/lib/subscription';
import { usePalette } from '@/lib/theme';

/** One subscription or key group: traffic, its page and link, Telegram proxies, servers. */
export default function ProfileScreen() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useStore((s) => s.profiles.find((x) => x.id === id));
  const [busy, setBusy] = useState(false);

  if (!profile) return <View style={{ flex: 1, backgroundColor: p.bg }} />;
  const info = profile.userInfo;
  const used = info ? info.upload + info.download : 0;
  const telegram = profile.telegram ?? [];

  async function open(url: string) {
    try {
      await openLink(url);
    } catch (e) {
      alert(t('linkFailed'), (e as Error).message);
    }
  }

  async function copy(text: string) {
    await Clipboard.setStringAsync(text);
    alert(t('copied'));
  }

  async function refresh() {
    setBusy(true);
    try {
      await refreshProfile(profile!.id);
    } catch (e) {
      alert(t('refresh'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    alert(t('remove'), t('removeConfirm', { name: profile!.name }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('remove'),
        style: 'destructive',
        onPress: () => {
          router.back();
          removeProfile(profile!.id);
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: profile.url ? t('subscription') : t('keyGroup') }} />

      <Card>
        <Text style={[styles.name, { color: p.text }]}>{profile.name}</Text>
        <Muted>
          {t('serversCount', { n: profile.servers.length })}
          {profile.url ? ` · ${t('updated', { date: formatDate(profile.updatedAt) })}` : ''}
        </Muted>
        {info ? (
          <View style={{ marginTop: 10, gap: 2 }}>
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
          </View>
        ) : null}
      </Card>

      {profile.url ? (
        <Card style={styles.group}>
          <Row
            first
            icon="globe-outline"
            title={t('subPage')}
            subtitle={t('subPageHint')}
            onPress={() => open(profile.url!)}
          />
          <Row icon="copy-outline" title={t('copySubLink')} onPress={() => copy(profile.url!)} />
          <Row
            icon="refresh-outline"
            title={busy ? t('pinging') : t('refreshOne')}
            onPress={busy ? undefined : refresh}
          />
        </Card>
      ) : null}

      {telegram.length > 0 ? (
        <>
          <SectionTitle>{t('telegramProxies')}</SectionTitle>
          <Card style={styles.group}>
            {telegram.map((link, i) => {
              const { kind, server } = telegramLabel(link);
              return (
                <Row
                  key={link}
                  first={i === 0}
                  icon="paper-plane-outline"
                  title={kind}
                  subtitle={server}
                  onPress={() => open(link)}
                  right={
                    <Pressable hitSlop={10} onPress={() => copy(link)} accessibilityLabel={t('copyLink')}>
                      <Ionicons name="copy-outline" size={18} color={p.text3} />
                    </Pressable>
                  }
                />
              );
            })}
          </Card>
          <Muted>{t('telegramHint')}</Muted>
        </>
      ) : null}

      {profile.servers.length > 0 ? (
        <>
          <SectionTitle>{t('servers')}</SectionTitle>
          <Card style={styles.group}>
            {profile.servers.map((server, i) => (
              <Row
                key={server.id}
                first={i === 0}
                title={server.name}
                subtitle={`${protocolLabel(server.outbound)} · ${serverAddress(server.outbound)}`}
              />
            ))}
          </Card>
        </>
      ) : null}

      <View style={{ marginTop: 18 }}>
        <Button title={t('removeGroup')} icon="trash-outline" kind="danger" onPress={remove} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40, gap: 10 },
  name: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  group: { padding: 0, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
});
