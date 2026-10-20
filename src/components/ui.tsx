import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { usePalette } from '@/lib/theme';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const p = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }, style]}>{children}</View>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const p = usePalette();
  const bg = kind === 'primary' ? p.accent : kind === 'danger' ? p.error : p.surface2;
  const fg = kind === 'primary' ? p.onAccent : kind === 'danger' ? '#fff' : p.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}>
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <Text style={{ color: p.text2, fontSize: 13, lineHeight: 18 }}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  button: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
