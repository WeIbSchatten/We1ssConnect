import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import XrayVpn from 'xray-vpn';

import { Card, Muted, Row, SectionTitle, Segmented, type IconName } from '@/components/ui';
import { updateGeo } from '@/lib/geo';
import { formatDate, t } from '@/lib/i18n';
import { updateSettings, useStore } from '@/lib/store';
import { usePalette } from '@/lib/theme';
import type { DnsProvider, Settings as SettingsType } from '@/lib/types';
import { reconnectIfActive } from '@/lib/vpn';

type Flag = { [K in keyof SettingsType]: SettingsType[K] extends boolean ? K : never }[keyof SettingsType];

export default function Settings() {
  const p = usePalette();
  const settings = useStore((s) => s.settings);
  const [core, setCore] = useState('');
  const [geoAt, setGeoAt] = useState(() => XrayVpn.geoUpdatedAt());
  const [geoBusy, setGeoBusy] = useState(false);

  function change(patch: Partial<SettingsType>) {
    updateSettings(patch);
    reconnectIfActive().catch((e) => Alert.alert(t('error'), (e as Error).message));
  }

  async function onGeo() {
    setGeoBusy(true);
    try {
      setGeoAt(await updateGeo());
      await reconnectIfActive();
    } catch (e) {
      Alert.alert(t('geoUpdate'), (e as Error).message);
    } finally {
      setGeoBusy(false);
    }
  }

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
          onValueChange={(v) => (live ? change({ [key]: v }) : updateSettings({ [key]: v }))}
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
        {toggle('ruDirect', 'flag-outline', t('ruDirect'), t('ruDirectHint'), true)}
        {toggle('blockAds', 'ban-outline', t('blockAds'), t('blockAdsHint'), true)}
        <Row
          icon="cloud-download-outline"
          title={geoBusy ? t('pinging') : t('geoUpdate')}
          subtitle={geoAt ? t('geoUpdated', { date: formatDate(geoAt) }) : t('geoMissing')}
          onPress={geoBusy ? undefined : onGeo}
        />
      </Card>

      <SectionTitle>{t('dns')}</SectionTitle>
      <Card style={[styles.group, { paddingTop: 12 }]}>
        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          <Segmented<DnsProvider>
            value={settings.dns}
            onChange={(v) => change({ dns: v })}
            options={[
              { value: 'cloudflare', label: 'Cloudflare' },
              { value: 'google', label: 'Google' },
              { value: 'quad9', label: 'Quad9' },
            ]}
          />
        </View>
        {toggle('dnsOverHttps', 'lock-closed-outline', t('doh'), t('dohHint'), true)}
        {toggle('ipv6', 'globe-outline', t('ipv6'), t('ipv6Hint'), true)}
      </Card>

      <SectionTitle>{t('security')}</SectionTitle>
      <Card style={styles.group}>
        {toggle('forceChromeFingerprint', 'finger-print-outline', t('forceChrome'), t('forceChromeHint'), true, true)}
        {toggle('fragment', 'cut-outline', t('fragment'), t('fragmentHint'), true)}
        {toggle('mux', 'git-merge-outline', t('mux'), t('muxHint'), true)}
        {toggle('autoPing', 'speedometer-outline', t('autoPing'), t('autoPingHint'), false)}
        {toggle('autoUpdate', 'refresh-outline', t('autoUpdate'), t('autoUpdateHint'), false)}
      </Card>

      <SectionTitle>{t('about')}</SectionTitle>
      <Card style={{ gap: 6 }}>
        <Muted>{t('aboutText')}</Muted>
        <Muted>{t('tileHint')}</Muted>
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
