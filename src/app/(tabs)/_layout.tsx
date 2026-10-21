import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Platform, Text, View, type ColorValue } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import type { IconName } from '@/components/ui';
import { t } from '@/lib/i18n';
import { usePalette } from '@/lib/theme';

function icon(name: IconName, active: IconName) {
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? active : name} size={size} color={color as string} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const p = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: p.bg },
        headerTintColor: p.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
        sceneStyle: { backgroundColor: p.bg },
        // The desktop window has no safe-area inset, and the default 49 px cut the labels off.
        tabBarStyle: [
          { backgroundColor: p.surface, borderTopColor: p.border },
          Platform.OS === 'web' && { height: 68 },
        ],
        tabBarActiveTintColor: p.accent,
        tabBarInactiveTintColor: p.text3,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'We1ssConnect',
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <BrandMark size={28} />
              <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>We1ssConnect</Text>
            </View>
          ),
          tabBarLabel: t('home'),
          tabBarIcon: icon('shield-outline', 'shield-checkmark'),
        }}
      />
      <Tabs.Screen
        name="servers"
        options={{ title: t('servers'), tabBarIcon: icon('server-outline', 'server') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t('settings'), tabBarIcon: icon('settings-outline', 'settings') }}
      />
    </Tabs>
  );
}
