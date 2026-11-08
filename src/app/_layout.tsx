import { Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold, useFonts } from '@expo-google-fonts/onest';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import XrayVpn from 'xray-vpn';

import { alert, DialogHost } from '@/components/dialog';
import '@/lib/desktopStyle';
import { lang, t } from '@/lib/i18n';
import { useIsLight, usePalette } from '@/lib/theme';
import { connect, disconnect, isActive } from '@/lib/vpn';

// Notifications and the quick settings tile are drawn natively and read this.
XrayVpn.setItem('native.language', lang);

export default function RootLayout() {
  const p = usePalette();
  const light = useIsLight();
  useEffect(
    () =>
      XrayVpn.onTrayToggle?.(() => {
        if (isActive()) disconnect();
        else connect().catch((e) => alert(t('error'), (e as Error).message));
      }),
    [],
  );
  // Bundled, so this resolves within a frame or two; until then the screen keeps its background.
  const [fonts] = useFonts({ Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold });
  if (!fonts) return null;
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
