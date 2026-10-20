import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import XrayVpn from 'xray-vpn';

import { Card, Muted } from '@/components/ui';
import { t } from '@/lib/i18n';
import { updateSettings, useStore } from '@/lib/store';
import { usePalette } from '@/lib/theme';
import type { Settings as SettingsType } from '@/lib/types';

export default function Settings() {
  const p = usePalette();
  const settings = useStore((s) => s.settings);
  const [core, setCore] = useState('');

  useEffect(() => {
    XrayVpn.xrayVersion().then(setCore, () => setCore('?'));
  }, []);

  const toggle = (key: keyof SettingsType, title: string, hint: string) => (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '500' }}>{title}</Text>
        <Muted>{hint}</Muted>
      </View>
      <Switch
        value={settings[key]}
        onValueChange={(v) => updateSettings({ [key]: v })}
        trackColor={{ true: p.accent, false: p.surface2 }}
      />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Card style={{ gap: 16 }}>
        {toggle('forceChromeFingerprint', t('forceChrome'), t('forceChromeHint'))}
        {toggle('bypassLan', t('bypassLan'), t('bypassLanHint'))}
      </Card>
      <Card style={{ gap: 6 }}>
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>{t('about')}</Text>
        <Muted>{t('aboutText')}</Muted>
        <Muted>
          We1ssConnect {Constants.expoConfig?.version} · {t('core', { v: core })}
        </Muted>
        <Muted>{t('licenses')}</Muted>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
