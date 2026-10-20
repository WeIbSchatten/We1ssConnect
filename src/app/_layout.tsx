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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ title: t('add'), presentation: 'modal' }} />
        <Stack.Screen name="apps" options={{ title: t('perApp') }} />
        <Stack.Screen name="scan" options={{ title: t('scanQr') }} />
      </Stack>
    </>
  );
}
