import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { t } from '@/lib/i18n';
import { usePalette } from '@/lib/theme';

export default function RootLayout() {
  const p = usePalette();
  const light = useColorScheme() === 'light';
  return (
    <>
      <StatusBar style={light ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: p.bg },
          headerTintColor: p.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: p.bg },
        }}>
        <Stack.Screen name="index" options={{ title: 'We1ssConnect' }} />
        <Stack.Screen name="servers" options={{ title: t('servers') }} />
        <Stack.Screen name="add" options={{ title: t('add'), presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: t('settings') }} />
      </Stack>
    </>
  );
}
