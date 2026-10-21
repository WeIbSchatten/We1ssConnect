import { Linking } from 'react-native';
import XrayVpn from 'xray-vpn';

/** Opens a link in its app (Telegram for tg:// and t.me) or the browser. */
export async function openLink(url: string): Promise<void> {
  if (XrayVpn.openUrl) return XrayVpn.openUrl(url);
  await Linking.openURL(url);
}
