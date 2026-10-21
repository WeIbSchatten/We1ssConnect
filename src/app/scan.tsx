import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { alert } from '@/components/dialog';
import { Button, Muted } from '@/components/ui';
import { t } from '@/lib/i18n';
import { addFromText } from '@/lib/subscription';
import { usePalette } from '@/lib/theme';

export default function Scan() {
  const p = usePalette();
  const [permission, request] = useCameraPermissions();
  // The camera reports the same code many times a second; take the first one.
  const done = useRef(false);

  async function onCode(data: string) {
    if (done.current) return;
    done.current = true;
    try {
      const n = await addFromText(data);
      alert(t('add'), t('added', { n }));
      router.dismissTo('/servers');
    } catch (e) {
      alert(t('error'), (e as Error).message, [{ text: 'OK', onPress: () => (done.current = false) }]);
    }
  }

  if (!permission) return <ActivityIndicator style={{ marginTop: 40 }} color={p.accent} />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Muted>{t('cameraDenied')}</Muted>
        <Button title={t('scanQr')} icon="camera-outline" onPress={() => void request()} />
      </View>
    );
  }
  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={({ data }) => void onCode(data)}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
});
