import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import XrayVpn from 'xray-vpn';

import { Card, Muted, Row, SectionTitle, type IconName } from '@/components/ui';
import { t } from '@/lib/i18n';
import { updateSettings, useStore } from '@/lib/store';
import { usePalette } from '@/lib/theme';
import type { Settings as SettingsType } from '@/lib/types';
import { reconnectIfActive } from '@/lib/vpn';

type Flag = { [K in keyof SettingsType]: SettingsType[K] extends boolean ? K : never }[keyof SettingsType];

export default function Settings() {
  const p = usePalette();
  const settings = useStore((s) => s.settings);
  const [core, setCore] = useState('');

  useEffect(() => {
    XrayVpn.xrayVersion().then(setCore, () => setCore('?'));
  }, []);

  /** `live` settings are part of the Xray config, so a running tunnel restarts with them. */
  const toggle = (key: Flag, icon: IconName, title: string, hint: string, live: boolean, first = false) => (
    <Row
      first={first}
      icon={icon}
      title={title}
      subtitle={hint}
      right={
        <Switch
          value={settings[key]}
          onValueChange={(v) => {
            updateSettings({ [key]: v });
            if (live) reconnectIfActive().catch((e) => Alert.alert(t('error'), (e as Error).message));
          }}
          trackColor={{ true: p.accent, false: p.surface2 }}
        />
      }
    />
  );

  const mode =
    settings.appMode === 'include'
      ? t('appModeInclude')
      : settings.appMode === 'exclude'
        ? t('appModeExclude')
        : t('appModeAll');
  const count = settings.appMode === 'all' ? '' : ` · ${t('appsSelected', { n: settings.apps.length })}`;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <SectionTitle>{t('routing')}</SectionTitle>
      <Card style={styles.group}>
        <Row first icon="apps-outline" title={t('perApp')} subtitle={mode + count} onPress={() => router.push('/apps')} />
        {toggle('bypassLan', 'home-outline', t('bypassLan'), t('bypassLanHint'), true)}
      </Card>

      <SectionTitle>{t('security')}</SectionTitle>
      <Card style={styles.group}>
        {toggle('forceChromeFingerprint', 'finger-print-outline', t('forceChrome'), t('forceChromeHint'), true, true)}
        {toggle('autoPing', 'speedometer-outline', t('autoPing'), t('autoPingHint'), false)}
      </Card>

      <SectionTitle>{t('about')}</SectionTitle>
      <Card style={{ gap: 6 }}>
        <Muted>{t('aboutText')}</Muted>
        <Muted>
          We1ssConnect {Constants.expoConfig?.version} · {t('core', { v: core })}
        </Muted>
        <Muted>{t('licenses')}</Muted>
      </Card>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingBottom: 16 },
  group: { padding: 0, overflow: 'hidden' },
});
