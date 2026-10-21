import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Animated, BackHandler, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/lib/i18n';
import { usePalette } from '@/lib/theme';

export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface Dialog {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
}

// One dialog at a time; later ones wait their turn, as the system alerts do.
let queue: Dialog[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Drop-in for Alert.alert, drawn in the app's own style. */
export function alert(title: string, message?: string, buttons?: DialogButton[]) {
  queue = [
    ...queue,
    {
      id: nextId++,
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: 'OK' }],
    },
  ];
  emit();
}

function close(id: number) {
  queue = queue.filter((d) => d.id !== id);
  emit();
}

function useCurrent(): Dialog | undefined {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => queue[0],
  );
}

/** Mounted once in the root layout. Menus (three or more choices) slide up as a sheet. */
export function DialogHost() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const dialog = useCurrent();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!dialog) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [dialog, anim]);

  useEffect(() => {
    if (!dialog) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss();
      return true;
    });
    return () => sub.remove();
  });

  if (!dialog) return null;
  const sheet = dialog.buttons.length > 2;
  const cancel = dialog.buttons.find((b) => b.style === 'cancel');

  function press(b?: DialogButton) {
    close(dialog!.id);
    b?.onPress?.();
  }

  function dismiss() {
    press(cancel ?? (dialog!.buttons.length === 1 ? dialog!.buttons[0] : undefined));
  }

  const color = (b: DialogButton) => (b.style === 'destructive' ? p.error : b.style === 'cancel' ? p.text2 : p.text);
  const ordered = sheet
    ? dialog.buttons
    : [...dialog.buttons].sort((a, b) => Number(b.style === 'cancel') - Number(a.style === 'cancel'));

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel={t('cancel')} />
      </Animated.View>
      <View pointerEvents="box-none" style={[styles.layer, sheet ? styles.bottom : styles.center]}>
        <Animated.View
          style={[
            sheet ? [styles.sheet, { paddingBottom: 12 + insets.bottom }] : styles.card,
            {
              backgroundColor: p.elevated,
              borderColor: p.borderStrong,
              opacity: anim,
              transform: sheet
                ? [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [40, 0],
                      }),
                    },
                  ]
                : [
                    {
                      scale: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.96, 1],
                      }),
                    },
                  ],
            },
          ]}>
          {sheet ? <View style={[styles.grabber, { backgroundColor: p.borderStrong }]} /> : null}
          <Text style={[styles.title, { color: p.text }]}>{dialog.title}</Text>
          {dialog.message ? <Text style={[styles.message, { color: p.text2 }]}>{dialog.message}</Text> : null}
          <View style={sheet ? styles.column : styles.row}>
            {ordered.map((b, i) => {
              const primary = !sheet && i === ordered.length - 1 && b.style !== 'cancel';
              return (
                <Pressable
                  key={i}
                  onPress={() => press(b)}
                  style={({ pressed }) => [
                    sheet ? styles.sheetButton : styles.button,
                    {
                      backgroundColor: primary ? (b.style === 'destructive' ? p.error : p.accent) : p.surface2,
                      borderColor: p.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.buttonText,
                      {
                        color: primary ? (b.style === 'destructive' ? '#fff' : p.onAccent) : color(b),
                      },
                    ]}>
                    {b.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  layer: { flex: 1, paddingHorizontal: 20 },
  center: { justifyContent: 'center' },
  bottom: { justifyContent: 'flex-end', paddingHorizontal: 0 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 10,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 17, fontWeight: '700' },
  message: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  column: { gap: 8, marginTop: 8 },
  button: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
