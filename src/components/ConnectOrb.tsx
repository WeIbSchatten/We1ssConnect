import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { orbitSeconds } from '@/lib/motion';
import { usePalette } from '@/lib/theme';

export type OrbState = 'off' | 'connecting' | 'on' | 'error';

const SIZE = 236;
const DISC = 156;
const ORBIT = 206;
const native = Platform.OS !== 'web';

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced, () => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

function useLoop(active: boolean, duration: number, easing = Easing.linear) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active) {
      v.stopAnimation();
      v.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [active, duration, easing, v]);
  return v;
}

/**
 * The connect button. Its motion carries the state: still rings while off, a sweeping arc
 * while connecting, and once connected a slow breath with satellites whose speed follows
 * the traffic through the tunnel.
 */
export function ConnectOrb({
  state,
  speed,
  disabled,
  onPress,
  label,
}: {
  state: OrbState;
  /** Bytes per second through the tunnel, down plus up. */
  speed: number;
  disabled?: boolean;
  onPress: () => void;
  label: string;
}) {
  const p = usePalette();
  const reduced = useReducedMotion();
  const on = state === 'on';
  const connecting = state === 'connecting';
  const color = on ? p.success : connecting ? p.warning : state === 'error' ? p.error : p.text3;

  const [press] = useState(() => new Animated.Value(1));
  const [lit] = useState(() => new Animated.Value(on ? 1 : 0));
  useEffect(() => {
    Animated.timing(lit, { toValue: on ? 1 : 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [on, lit]);

  const sweep = useLoop(connecting && !reduced, 1100);
  const breath = useLoop(on && !reduced, 3200, Easing.inOut(Easing.sin));
  // Re-keyed by speed bucket, so the orbit only restarts when the pace really changes.
  const seconds = Math.round(orbitSeconds(speed) * 2) / 2;
  const orbit = useLoop(on && !reduced, seconds * 1000);

  const spin = (v: Animated.Value) => v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const halo = breath.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.08, 0.2, 0.08] });
  const haloScale = breath.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.06, 1] });

  return (
    <View style={styles.wrap}>
      {/* Halo: fades in on connect, then breathes. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          { backgroundColor: p.success, opacity: Animated.multiply(lit, halo), transform: [{ scale: haloScale }] },
        ]}
      />
      <Svg pointerEvents="none" width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={ORBIT / 2} stroke={color} strokeOpacity={0.22} strokeWidth={1} fill="none" />
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={DISC / 2 + 14} stroke={color} strokeOpacity={0.12} strokeWidth={1} fill="none" />
      </Svg>
      {connecting && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin(sweep) }] }]}>
          <Svg width={SIZE} height={SIZE}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={ORBIT / 2}
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${(Math.PI * ORBIT) / 5} ${Math.PI * ORBIT}`}
              fill="none"
            />
          </Svg>
        </Animated.View>
      )}
      {on && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: lit, transform: [{ rotate: spin(orbit) }] }]}>
          {[0, 120, 240].map((deg, i) => (
            <View
              key={deg}
              style={[
                styles.satellite,
                {
                  backgroundColor: p.success,
                  opacity: 1 - i * 0.28,
                  transform: [{ rotate: `${deg}deg` }, { translateY: -ORBIT / 2 }],
                },
              ]}
            />
          ))}
        </Animated.View>
      )}
      <Animated.View style={{ transform: [{ scale: press }] }}>
        <Pressable
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPressIn={() => Animated.spring(press, { toValue: 0.94, useNativeDriver: native, speed: 40 }).start()}
          onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: native, friction: 4 }).start()}
          style={[
            styles.disc,
            { backgroundColor: on ? p.accentSoft : p.surface, borderColor: color, opacity: disabled ? 0.45 : 1 },
          ]}>
          <Ionicons name="power" size={58} color={on ? p.success : p.text} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: DISC + 40, height: DISC + 40, borderRadius: (DISC + 40) / 2 },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  satellite: {
    position: 'absolute',
    top: SIZE / 2 - 4,
    left: SIZE / 2 - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
