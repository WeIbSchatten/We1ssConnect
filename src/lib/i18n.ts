const en = {
  connect: 'Connect',
  disconnect: 'Disconnect',
  connecting: 'Connecting…',
  connected: 'Connected',
  disconnected: 'Not connected',
  error: 'Connection failed',
  noServers: 'No servers yet',
  noServersHint: 'Add a subscription link from your We1ssBoard panel or paste a vless://, vmess://, trojan://, ss:// or hysteria2:// link.',
  addServers: 'Add servers',
  servers: 'Servers',
  settings: 'Settings',
  add: 'Add',
  addTitle: 'Add a subscription or links',
  addHint: 'Subscription URL (https://…) or one link per line',
  paste: 'Paste from clipboard',
  added: 'Added servers: {n}',
  refresh: 'Update subscriptions',
  ping: 'Test delay',
  pingStopFirst: 'Disconnect first to test the delay',
  remove: 'Remove',
  removeConfirm: 'Remove "{name}" and its servers?',
  cancel: 'Cancel',
  traffic: 'Used {used} of {total}',
  trafficUnlimited: 'Used {used}',
  expires: 'Until {date}',
  updated: 'Updated {date}',
  manualProfile: 'Added manually',
  vpnDenied: 'VPN permission was not granted',
  forceChrome: 'Chrome fingerprint for Reality',
  forceChromeHint: 'Fixes connecting to Reality servers on Xray 26.9.8 and newer.',
  bypassLan: 'Bypass local network',
  bypassLanHint: 'Router, printers and other LAN devices are reached directly.',
  about: 'About',
  aboutText: 'We1ssConnect is the client app for We1ssBoard.',
  licenses: 'Uses Xray-core (MPL-2.0, github.com/XTLS/Xray-core) and libXray (MIT, github.com/XTLS/libXray).',
  core: 'Xray core {v}',
};

type Dict = typeof en;

const ru: Dict = {
  connect: 'Подключить',
  disconnect: 'Отключить',
  connecting: 'Подключение…',
  connected: 'Подключено',
  disconnected: 'Не подключено',
  error: 'Не удалось подключиться',
  noServers: 'Серверов пока нет',
  noServersHint: 'Добавь ссылку на подписку из панели We1ssBoard или вставь ссылку vless://, vmess://, trojan://, ss:// или hysteria2://.',
  addServers: 'Добавить серверы',
  servers: 'Серверы',
  settings: 'Настройки',
  add: 'Добавить',
  addTitle: 'Подписка или ссылки',
  addHint: 'Ссылка на подписку (https://…) или по ссылке на строку',
  paste: 'Вставить из буфера',
  added: 'Добавлено серверов: {n}',
  refresh: 'Обновить подписки',
  ping: 'Проверить задержку',
  pingStopFirst: 'Чтобы проверить задержку, сначала отключись',
  remove: 'Удалить',
  removeConfirm: 'Удалить «{name}» и её серверы?',
  cancel: 'Отмена',
  traffic: 'Использовано {used} из {total}',
  trafficUnlimited: 'Использовано {used}',
  expires: 'До {date}',
  updated: 'Обновлено {date}',
  manualProfile: 'Добавлены вручную',
  vpnDenied: 'Разрешение на VPN не выдано',
  forceChrome: 'Отпечаток Chrome для Reality',
  forceChromeHint: 'Чинит подключение к Reality-серверам на Xray 26.9.8 и новее.',
  bypassLan: 'Локальная сеть напрямую',
  bypassLanHint: 'Роутер, принтеры и другие устройства в сети доступны без VPN.',
  about: 'О приложении',
  aboutText: 'We1ssConnect — клиент для панели We1ssBoard.',
  licenses: 'Использует Xray-core (MPL-2.0, github.com/XTLS/Xray-core) и libXray (MIT, github.com/XTLS/libXray).',
  core: 'Ядро Xray {v}',
};

function systemLanguage(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2).toLowerCase();
  } catch {
    return 'en';
  }
}

export const lang = systemLanguage() === 'ru' ? 'ru' : 'en';
const dict: Dict = lang === 'ru' ? ru : en;

export function t(key: keyof Dict, vars: Record<string, string | number> = {}): string {
  return dict[key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

export function formatBytes(n: number): string {
  const units = lang === 'ru' ? ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'] : ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 || n >= 100 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US');
}
