import { ActivityIndicator, Alert, Linking, Text, View, type ViewStyle } from 'react-native';

import { Button, Card, Muted } from '@/components/ui';
import { formatBytes, t } from '@/lib/i18n';
import { usePalette } from '@/lib/theme';
import { installUpdate, useUpdater } from '@/lib/updater';

/** A newer version with its notes and an install button; nothing when up to date. */
export function UpdateCard({ notes = false, style }: { notes?: boolean; style?: ViewStyle }) {
  const p = usePalette();
  const { update, progress } = useUpdater();
  if (!update) return null;

  function install() {
    installUpdate(update!).catch((e) =>
      Alert.alert(t('updateFailed'), (e as Error).message, [
        { text: t('openRelease'), onPress: () => void Linking.openURL(update!.page) },
        { text: 'OK' },
      ]),
    );
  }

  return (
    <Card style={[{ gap: 8, borderColor: p.accent }, style ?? {}]}>
      <Text style={{ color: p.text, fontSize: 16, fontWeight: '600' }}>
        {t('updateAvailable', { v: update.version })}
      </Text>
      {notes && update.notes ? <Muted numberOfLines={12}>{update.notes.replace(/[#*`]/g, '')}</Muted> : null}
      {progress !== undefined ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={p.accent} />
          <Muted>{t('downloading', { p: Math.round(progress * 100) })}</Muted>
        </View>
      ) : (
        <Button
          title={t('updateInstall', { size: formatBytes(update.size) })}
          icon="download-outline"
          onPress={install}
        />
      )}
    </Card>
  );
}
