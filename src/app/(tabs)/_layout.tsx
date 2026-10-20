import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

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
        sceneStyle: { backgroundColor: p.bg },
        tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.border },
        tabBarActiveTintColor: p.accent,
        tabBarInactiveTintColor: p.text3,
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'We1ssConnect', tabBarLabel: t('home'), tabBarIcon: icon('shield-outline', 'shield-checkmark') }}
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
