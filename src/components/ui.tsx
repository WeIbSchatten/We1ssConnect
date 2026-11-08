import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { t } from '@/lib/i18n';
import { FONT, usePalette } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const p = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }, style]}>{children}</View>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
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
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}>
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Muted({ children, numberOfLines }: { children: ReactNode; numberOfLines?: number }) {
  const p = usePalette();
  return (
    <Text numberOfLines={numberOfLines} style={{ color: p.text2, fontSize: 13, lineHeight: 18 }}>
      {children}
    </Text>
  );
}

/** A row of figures like the panel's summary strip: small muted caption, big value. */
export function Stats({ items }: { items: { label: string; value: string; color?: string }[] }) {
  const p = usePalette();
  return (
    <View style={[styles.card, styles.stats, { backgroundColor: p.surface, borderColor: p.border }]}>
      {items.map((item, i) => (
        <View
          key={item.label}
          style={[styles.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: p.border }]}>
          <Text style={{ color: p.text3, fontSize: 12, fontFamily: FONT.medium }} numberOfLines={1}>
            {item.label}
          </Text>
          <Text
            style={{ color: item.color ?? p.text, fontSize: 19, fontFamily: FONT.semibold, fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <Text style={[styles.section, { color: p.text3 }]}>{children}</Text>;
}

/** A settings-style row: icon, title, optional subtitle and something on the right. */
export function Row({
  icon,
  title,
  subtitle,
  right,
  onPress,
  first,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  first?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border },
        pressed && onPress ? { backgroundColor: p.surface2 } : null,
      ]}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: p.accentSoft }]}>
          <Ionicons name={icon} size={18} color={p.accent} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.text, fontSize: 15, fontFamily: FONT.medium }}>{title}</Text>
        {subtitle ? <Muted>{subtitle}</Muted> : null}
      </View>
      {right}
      {onPress && !right ? <Ionicons name="chevron-forward" size={18} color={p.text3} /> : null}
    </Pressable>
  );
}

/** Delay as a coloured pill: green under 300 ms, amber above, red when not answering. */
export function PingBadge({ ping }: { ping?: number }) {
  const p = usePalette();
  if (ping === undefined) return null;
  const color = ping < 0 ? p.error : ping < 300 ? p.success : p.warning;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={{ color, fontSize: 12, fontFamily: FONT.semibold, fontVariant: ['tabular-nums'] }}>
        {ping < 0 ? t('timeout') : t('ms', { n: ping })}
      </Text>
    </View>
  );
}

/** Options in a track; the highlight slides to the chosen one, so the change is visible. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const [x] = useState(() => new Animated.Value(index));
  useEffect(() => {
    Animated.spring(x, { toValue: index, useNativeDriver: Platform.OS !== 'web', friction: 9, tension: 90 }).start();
  }, [index, x]);
  const slot = width > 0 ? (width - 6 - 3 * (options.length - 1)) / options.length : 0;
  return (
    <View style={[styles.segmented, { backgroundColor: p.surface2 }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {slot > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentPill,
            { width: slot, backgroundColor: p.surface, borderColor: p.borderStrong },
            { transform: [{ translateX: Animated.multiply(x, slot + 3) }] },
          ]}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={styles.segment}>
            <Text numberOfLines={1} style={{ color: active ? p.text : p.text2, fontSize: 13, fontFamily: active ? FONT.semibold : FONT.medium }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // As the panel's cards: 16 px corners, a 1 px border and a soft shadow.
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: { fontSize: 15, fontFamily: FONT.semibold },
  section: {
    fontSize: 14,
    fontFamily: FONT.semibold,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  stats: { flexDirection: 'row', padding: 4 },
  stat: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, gap: 4 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6 },
  segmentPill: { position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
});
