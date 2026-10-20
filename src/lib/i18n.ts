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
  home: 'Home',
  auto: 'Auto (fastest)',
  autoHint: 'Picks the server with the lowest delay and switches if it stops answering',
  autoNow: 'Now: {name}',
  yourIp: 'Your IP',
  ipLoading: 'Checking your IP…',
  ipFailed: 'Could not check the IP',
  speed: 'Speed',
  session: 'This session',
  duration: 'Connected for {time}',
  ms: '{n} ms',
  timeout: 'timeout',
  sortByPing: 'Sort by delay',
  pinging: 'Testing…',
  routing: 'Routing',
  perApp: 'Per-app routing',
  appModeAll: 'All apps',
  appModeInclude: 'Only selected apps',
  appModeExclude: 'All except selected',
  appsSelected: '{n} selected',
  searchApps: 'Search apps',
  showSystem: 'Show system apps',
  appsHint: 'Changes apply on the next connect.',
  autoPing: 'Test delays on start',
  autoPingHint: 'Measures every server when the app opens and the VPN is off.',
  security: 'Connection',
  reconnectHint: 'Reconnect to apply.',
  geoFailed: 'Could not download the routing rules: {error}',
  ruDirect: 'Russian sites directly',
  ruDirectHint: 'Russian domains and IP addresses bypass the VPN.',
  blockAds: 'Block ads',
  blockAdsHint: 'Ad and tracker domains are dropped.',
  geoUpdate: 'Update routing rules',
  geoUpdated: 'Downloaded {date}',
  geoMissing: 'Downloaded on the first connect with a preset on',
  dns: 'DNS',
  doh: 'DNS over HTTPS',
  dohHint: 'Encrypted queries to the same resolver.',
  ipv6: 'IPv6',
  ipv6Hint: 'Use IPv6 addresses when the site and server have them.',
  fragment: 'TLS fragmentation',
  fragmentHint: 'Splits the TLS handshake so DPI cannot read the server name. Helps when a TLS server is blocked.',
  mux: 'Multiplexing (mux)',
  muxHint: 'Many connections over one. Skipped for Vision, XHTTP and Hysteria.',
  autoUpdate: 'Update subscriptions on start',
  autoUpdateHint: 'Subscriptions older than 12 hours are refreshed when the app opens.',
  scanQr: 'Scan QR code',
  cameraDenied: 'Camera access is needed to scan a QR code',
  copyLink: 'Copy link',
  copied: 'Link copied',
  tileHint: 'A We1ssConnect tile can be added to quick settings to connect from the notification shade.',
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
  home: 'Главная',
  auto: 'Авто (самый быстрый)',
  autoHint: 'Выбирает сервер с наименьшей задержкой и переключается, если он перестал отвечать',
  autoNow: 'Сейчас: {name}',
  yourIp: 'Ваш IP',
  ipLoading: 'Проверяю IP…',
  ipFailed: 'Не удалось проверить IP',
  speed: 'Скорость',
  session: 'За сеанс',
  duration: 'Подключено {time}',
  ms: '{n} мс',
  timeout: 'нет ответа',
  sortByPing: 'По задержке',
  pinging: 'Проверяю…',
  routing: 'Маршрутизация',
  perApp: 'Маршрутизация по приложениям',
  appModeAll: 'Все приложения',
  appModeInclude: 'Только выбранные',
  appModeExclude: 'Все, кроме выбранных',
  appsSelected: 'Выбрано: {n}',
  searchApps: 'Поиск приложений',
  showSystem: 'Показывать системные',
  appsHint: 'Изменения применятся при следующем подключении.',
  autoPing: 'Проверять задержку при запуске',
  autoPingHint: 'Измеряет все серверы, когда приложение открыто, а VPN выключен.',
  security: 'Подключение',
  reconnectHint: 'Переподключитесь, чтобы применить.',
  geoFailed: 'Не удалось скачать правила маршрутизации: {error}',
  ruDirect: 'Российские сайты напрямую',
  ruDirectHint: 'Российские домены и IP-адреса идут мимо VPN.',
  blockAds: 'Блокировать рекламу',
  blockAdsHint: 'Рекламные и следящие домены отбрасываются.',
  geoUpdate: 'Обновить правила маршрутизации',
  geoUpdated: 'Скачаны {date}',
  geoMissing: 'Скачаются при первом подключении с включённым пресетом',
  dns: 'DNS',
  doh: 'DNS через HTTPS',
  dohHint: 'Зашифрованные запросы к тому же резолверу.',
  ipv6: 'IPv6',
  ipv6Hint: 'Использовать IPv6, если он есть у сайта и сервера.',
  fragment: 'Фрагментация TLS',
  fragmentHint: 'Дробит TLS-рукопожатие, чтобы DPI не прочитал имя сервера. Помогает, если TLS-сервер блокируют.',
  mux: 'Мультиплексирование (mux)',
  muxHint: 'Много соединений через одно. Не применяется к Vision, XHTTP и Hysteria.',
  autoUpdate: 'Обновлять подписки при запуске',
  autoUpdateHint: 'Подписки старше 12 часов обновляются при открытии приложения.',
  scanQr: 'Сканировать QR-код',
  cameraDenied: 'Чтобы сканировать QR-код, нужен доступ к камере',
  copyLink: 'Скопировать ссылку',
  copied: 'Ссылка скопирована',
  tileHint: 'Плитку We1ssConnect можно добавить в быстрые настройки и подключаться из шторки.',
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

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/${lang === 'ru' ? 'с' : 's'}`;
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Country name in the app language, falling back to what the IP service said. */
export function countryName(code?: string, fallback?: string): string {
  if (code) {
    try {
      const names = new Intl.DisplayNames([lang], { type: 'region' });
      const name = names.of(code.toUpperCase());
      if (name) return name;
    } catch {
      // Intl.DisplayNames is missing on some engines.
    }
  }
  return fallback ?? code ?? '';
}
