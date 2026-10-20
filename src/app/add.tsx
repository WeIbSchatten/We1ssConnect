import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Muted } from '@/components/ui';
import { t } from '@/lib/i18n';
import { addFromText } from '@/lib/subscription';
import { usePalette } from '@/lib/theme';

export default function Add() {
  const p = usePalette();
  // we1ssconnect://add?url=… opens this screen with the link filled in.
  const params = useLocalSearchParams<{ url?: string }>();
  const [text, setText] = useState(params.url ?? '');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function paste() {
    setText(await Clipboard.getStringAsync());
  }

  async function submit() {
    setBusy(true);
    try {
      const n = await addFromText(text, name);
      Alert.alert(t('add'), t('added', { n }));
      router.back();
    } catch (e) {
      Alert.alert(t('error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Muted>{t('addHint')}</Muted>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="https://… / vless://…"
        placeholderTextColor={p.text3}
        style={[styles.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]}
      />
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('groupName')}
        placeholderTextColor={p.text3}
        style={[styles.name, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]}
      />
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title={t('paste')} icon="clipboard-outline" kind="secondary" onPress={paste} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t('scanQr')} icon="qr-code-outline" kind="secondary" onPress={() => router.push('/scan')} />
          </View>
        </View>
        {busy ? (
          <ActivityIndicator color={p.accent} />
        ) : (
          <Button title={t('add')} onPress={submit} disabled={!text.trim()} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14 },
  name: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  input: {
    minHeight: 140,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
  },
});
