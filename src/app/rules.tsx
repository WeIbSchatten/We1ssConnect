import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { alert } from '@/components/dialog';
import { Button, Card, Muted, Segmented } from '@/components/ui';
import { t } from '@/lib/i18n';
import { parseEntries, type CustomRules } from '@/lib/rules';
import { updateSettings, useStore } from '@/lib/store';
import { usePalette } from '@/lib/theme';
import { reconnectIfActive } from '@/lib/vpn';

type Target = keyof CustomRules;

const EXAMPLES: Record<Target, string> = {
  proxy: 'geosite:ru-blocked\ngeosite:youtube\ngeoip:telegram',
  direct: 'geoip:ru\nexample.com\n10.0.0.0/8',
  block: 'geosite:category-ads-all\ntracker.example',
};

export default function Rules() {
  const p = usePalette();
  const saved = useStore((s) => s.settings.customRules);
  const [target, setTarget] = useState<Target>('proxy');
  const [text, setText] = useState<Record<Target, string>>({
    proxy: saved.proxy.join('\n'),
    direct: saved.direct.join('\n'),
    block: saved.block.join('\n'),
  });

  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter((x) => x);
  const invalid = parseEntries(lines(text[target])).invalid;

  function save() {
    const rules: CustomRules = { proxy: lines(text.proxy), direct: lines(text.direct), block: lines(text.block) };
    updateSettings({ customRules: rules });
    reconnectIfActive().catch((e) => alert(t('error'), (e as Error).message));
    router.back();
  }

  const all = (['proxy', 'direct', 'block'] as Target[]).flatMap((k) => parseEntries(lines(text[k])).invalid);

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={styles.page}>
      <Segmented<Target>
        value={target}
        onChange={setTarget}
        options={[
          { value: 'proxy', label: t('rulesProxy') },
          { value: 'direct', label: t('rulesDirect') },
          { value: 'block', label: t('rulesBlock') },
        ]}
      />
      <Muted>{t(target === 'proxy' ? 'rulesProxyHint' : target === 'direct' ? 'rulesDirectHint' : 'rulesBlockHint')}</Muted>
      <Card>
        <TextInput
          value={text[target]}
          onChangeText={(v) => setText({ ...text, [target]: v })}
          placeholder={EXAMPLES[target]}
          placeholderTextColor={p.text3}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { color: p.text }]}
        />
      </Card>
      {invalid.length ? (
        <Text style={{ color: p.error, fontSize: 13 }}>{t('rulesInvalid', { list: invalid.join(', ') })}</Text>
      ) : null}
      <Muted>{t('rulesSyntax')}</Muted>
      <View style={{ marginTop: 4 }}>
        <Button title={t('save')} icon="checkmark" onPress={save} disabled={all.length > 0} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32, gap: 12 },
  input: { minHeight: 160, fontSize: 14, fontFamily: 'monospace', textAlignVertical: 'top', padding: 4 },
});
