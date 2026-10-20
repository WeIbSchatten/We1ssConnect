import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import XrayVpn, { type AppMode, type InstalledApp } from 'xray-vpn';

import { Muted, Segmented } from '@/components/ui';
import { t } from '@/lib/i18n';
import { updateSettings, useStore } from '@/lib/store';
import { usePalette } from '@/lib/theme';

const icons = new Map<string, Promise<string | null>>();

function AppIcon({ id }: { id: string }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!icons.has(id)) icons.set(id, XrayVpn.appIcon(id).catch(() => null));
    void icons.get(id)!.then((v) => alive && setUri(v));
    return () => {
      alive = false;
    };
  }, [id]);
  return uri ? <Image source={{ uri }} style={styles.icon} /> : <View style={styles.icon} />;
}

export default function Apps() {
  const p = usePalette();
  const mode = useStore((s) => s.settings.appMode);
  const selected = useStore((s) => s.settings.apps);
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [query, setQuery] = useState('');
  const [system, setSystem] = useState(false);

  useEffect(() => {
    XrayVpn.installedApps().then(setApps, () => setApps([]));
  }, []);

  const chosen = useMemo(() => new Set(selected), [selected]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (apps ?? [])
      .filter((a) => system || !a.system || chosen.has(a.id))
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q))
      .sort((a, b) => Number(chosen.has(b.id)) - Number(chosen.has(a.id)));
    // The order is taken once per search so ticking an app does not make it jump.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps, query, system]);

  function flip(id: string) {
    updateSettings({ apps: chosen.has(id) ? selected.filter((x) => x !== id) : [...selected, id] });
  }

  const header = (
    <View style={{ gap: 12, marginBottom: 8 }}>
      <Segmented<AppMode>
        value={mode}
        onChange={(v) => updateSettings({ appMode: v })}
        options={[
          { value: 'all', label: t('appModeAll') },
          { value: 'include', label: t('appModeInclude') },
          { value: 'exclude', label: t('appModeExclude') },
        ]}
      />
      <Muted>{t('appsHint')}</Muted>
      {mode !== 'all' ? (
        <>
          <View style={[styles.search, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Ionicons name="search" size={18} color={p.text3} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('searchApps')}
              placeholderTextColor={p.text3}
              style={{ flex: 1, color: p.text, fontSize: 15, paddingVertical: 10 }}
            />
          </View>
          <View style={styles.line}>
            <Text style={{ flex: 1, color: p.text, fontSize: 15 }}>{t('showSystem')}</Text>
            <Switch value={system} onValueChange={setSystem} trackColor={{ true: p.accent, false: p.surface2 }} />
          </View>
          <Muted>{t('appsSelected', { n: selected.length })}</Muted>
        </>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={styles.page}
      data={mode === 'all' ? [] : list}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={header}
      ListEmptyComponent={mode !== 'all' && apps === null ? <ActivityIndicator color={p.accent} /> : undefined}
      initialNumToRender={20}
      renderItem={({ item }) => {
        const on = chosen.has(item.id);
        return (
          <Pressable
            onPress={() => flip(item.id)}
            style={({ pressed }) => [styles.line, styles.app, pressed && { backgroundColor: p.surface2 }]}>
            <AppIcon id={item.id} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.text, fontSize: 15 }} numberOfLines={1}>
                {item.name}
              </Text>
              <Muted numberOfLines={1}>{item.id}</Muted>
            </View>
            <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? p.accent : p.text3} />
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  app: { paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10 },
  icon: { width: 36, height: 36, borderRadius: 8 },
});
