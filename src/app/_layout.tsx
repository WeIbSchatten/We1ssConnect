import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import XrayVpn from 'xray-vpn';

import { DialogHost } from '@/components/dialog';
import '@/lib/desktopStyle';
import { lang, t } from '@/lib/i18n';
import { useIsLight, usePalette } from '@/lib/theme';

// Notifications and the quick settings tile are drawn natively and read this.
XrayVpn.setItem('native.language', lang);

export default function RootLayout() {
  const p = usePalette();
  const light = useIsLight();
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
        <Stack.Screen name="rules" options={{ title: t('rules') }} />
        <Stack.Screen name="profile" options={{ title: t('subscription') }} />
        <Stack.Screen name="scan" options={{ title: t('scanQr') }} />
      </Stack>
      <DialogHost />
    </>
  );
}
