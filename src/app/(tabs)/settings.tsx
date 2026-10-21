import Constants from 'expo-constants';
import { router } from 'expo-router';
import { reloadAppAsync } from 'expo';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, View } from 'react-native';
import XrayVpn from 'xray-vpn';

import { alert } from '@/components/dialog';
import { UpdateCard } from '@/components/UpdateCard';
import { Card, Muted, Row, SectionTitle, Segmented, type IconName } from '@/components/ui';
import { updateGeo } from '@/lib/geo';
import { formatDate, lang, t } from '@/lib/i18n';
import type { StylePreset } from '@/lib/palettes';
import { updateSettings, useStore } from '@/lib/store';
import { usePalette } from '@/lib/theme';
import type { DnsProvider, Language, PingMode, Settings as SettingsType, ThemeMode } from '@/lib/types';
import { checkForUpdate, useUpdater } from '@/lib/updater';
import { reconnectIfActive } from '@/lib/vpn';

type Flag = { [K in keyof SettingsType]: SettingsType[K] extends boolean ? K : never }[keyof SettingsType];

export default function Settings() {
  const p = usePalette();
  const settings = useStore((s) => s.settings);
  const [core, setCore] = useState('');
  const [geoAt, setGeoAt] = useState(() => XrayVpn.geoUpdatedAt());
  const [geoBusy, setGeoBusy] = useState(false);
  const updater = useUpdater();

  function setLanguage(v: Language) {
    if (v === lang) return;
    updateSettings({ language: v });
    XrayVpn.setItem('native.language', v);
    // Every screen reads the language once, so the app starts over in the new one.
    reloadAppAsync().catch(() => alert(t('language'), t('restartHint')));
  }

  function onCheck() {
    checkForUpdate()
      .then((u) => (u ? undefined : alert(t('updates'), t('upToDate'))))
      .catch((e) => alert(t('updates'), (e as Error).message));
  }

  function change(patch: Partial<SettingsType>) {
    updateSettings(patch);
    reconnectIfActive().catch((e) => alert(t('error'), (e as Error).message));
  }

  async function onGeo() {
    setGeoBusy(true);
    try {
      setGeoAt(await updateGeo());
      await reconnectIfActive();
    } catch (e) {
      alert(t('geoUpdate'), (e as Error).message);
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
        <View style={styles.inset}>
          <Muted>{t('pingMode')}</Muted>
          <Segmented<PingMode>
            value={settings.pingMode}
            onChange={(v) => updateSettings({ pingMode: v })}
            options={[
              { value: 'server', label: t('pingServer') },
              { value: 'full', label: t('pingFull') },
            ]}
          />
          <Muted>{settings.pingMode === 'full' ? t('pingFullHint') : t('pingServerHint')}</Muted>
        </View>
        {toggle('autoPing', 'speedometer-outline', t('autoPing'), t('autoPingHint'), false)}
        {toggle('autoUpdate', 'refresh-outline', t('autoUpdate'), t('autoUpdateHint'), false)}
      </Card>

      <SectionTitle>{t('appearance')}</SectionTitle>
      <Card style={{ gap: 12 }}>
        <Muted>{t('theme')}</Muted>
        <Segmented<ThemeMode>
          value={settings.theme}
          onChange={(v) => updateSettings({ theme: v })}
          options={[
            { value: 'system', label: t('themeSystem') },
            { value: 'light', label: t('themeLight') },
            { value: 'dark', label: t('themeDark') },
            { value: 'amoled', label: 'AMOLED' },
          ]}
        />
        <Muted>{t('colors')}</Muted>
        <Segmented<StylePreset>
          value={settings.style}
          onChange={(v) => updateSettings({ style: v })}
          options={[
            { value: 'ocean', label: t('styleOcean') },
            { value: 'emerald', label: t('styleEmerald') },
            { value: 'pastel', label: t('stylePastel') },
            { value: 'mono', label: t('styleMono') },
          ]}
        />
        <Muted>{t('language')}</Muted>
        <Segmented<Language>
          value={settings.language}
          onChange={setLanguage}
          options={[
            { value: 'ru', label: 'Русский' },
            { value: 'en', label: 'English' },
          ]}
        />
      </Card>

      <SectionTitle>{t('updates')}</SectionTitle>
      <UpdateCard notes style={{ marginBottom: 12 }} />
      <Card style={styles.group}>
        <Row
          first
          icon="sync-outline"
          title={updater.checking ? t('checking') : t('checkUpdates')}
          subtitle={t('versionNow', { v: Constants.expoConfig?.version ?? '' })}
          onPress={updater.checking ? undefined : onCheck}
        />
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
      <Card style={[styles.group, { marginTop: 12 }]}>
        <Row
          first
          icon="book-outline"
          title={t('docs')}
          onPress={() => void Linking.openURL(`https://weibschatten.github.io/We1ssConnect/#/${lang}/`)}
        />
      </Card>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  inset: {
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127, 127, 127, 0.25)',
  },
  page: { paddingHorizontal: 16, paddingBottom: 16 },
  group: { padding: 0, overflow: 'hidden' },
});
