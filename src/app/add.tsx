import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { alert } from '@/components/dialog';
import { Button, Muted, Segmented } from '@/components/ui';
import { loginToPortal, portalErrorText } from '@/lib/account';
import { column } from '@/lib/layout';
import { t } from '@/lib/i18n';
import { portalBase } from '@/lib/portal';
import { addFromText } from '@/lib/subscription';
import { usePalette } from '@/lib/theme';

type Mode = 'link' | 'login';

export default function Add() {
  const p = usePalette();
  // we1ssconnect://add?url=… fills in a link; ?mode=login&base=…&login=… opens the login form.
  const params = useLocalSearchParams<{ url?: string; mode?: string; base?: string; login?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'login' ? 'login' : 'link');
  const [text, setText] = useState(params.url ?? '');
  const [name, setName] = useState('');
  const [base, setBase] = useState(params.base ?? '');
  const [login, setLogin] = useState(params.login ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const field = [styles.name, { color: p.text, backgroundColor: p.surface, borderColor: p.border }];

  async function paste() {
    setText(await Clipboard.getStringAsync());
  }

  async function submit() {
    setBusy(true);
    try {
      const n = await addFromText(text, name);
      alert(t('add'), t('added', { n }));
      router.back();
    } catch (e) {
      alert(t('error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function logIn() {
    setBusy(true);
    try {
      const profile = await loginToPortal(base, login, password);
      setPassword('');
      alert(t('logIn'), t('loggedIn', { n: profile.servers.length }));
      router.back();
    } catch (e) {
      let shown = base;
      try {
        shown = portalBase(base);
      } catch {
        // An empty address already failed inside loginToPortal with its own message.
      }
      alert(t('error'), portalErrorText(e, shown));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.page, column]} keyboardShouldPersistTaps="handled">
      <Segmented<Mode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'link', label: t('addByLink') },
          { value: 'login', label: t('addByLogin') },
        ]}
      />
      {mode === 'link' ? (
        <>
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
            style={field}
          />
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button title={t('paste')} icon="clipboard-outline" kind="secondary" onPress={paste} />
              </View>
              {Platform.OS !== 'web' && (
                <View style={{ flex: 1 }}>
                  <Button title={t('scanQr')} icon="qr-code-outline" kind="secondary" onPress={() => router.push('/scan')} />
                </View>
              )}
            </View>
            {busy ? (
              <ActivityIndicator color={p.accent} />
            ) : (
              <Button title={t('add')} onPress={submit} disabled={!text.trim()} />
            )}
          </View>
        </>
      ) : (
        <>
          <Muted>{t('loginHint')}</Muted>
          <TextInput
            value={base}
            onChangeText={setBase}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder={t('portalAddress')}
            placeholderTextColor={p.text3}
            style={field}
          />
          <TextInput
            value={login}
            onChangeText={setLogin}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            placeholder={t('portalLogin')}
            placeholderTextColor={p.text3}
            style={field}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder={t('portalPassword')}
            placeholderTextColor={p.text3}
            style={field}
          />
          {busy ? (
            <ActivityIndicator color={p.accent} />
          ) : (
            <Button title={t('logIn')} onPress={logIn} disabled={!base.trim() || !login.trim() || !password} />
          )}
        </>
      )}
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
