import type { Locale } from './i18n';

// Strings of the React-rendered chrome (home page, navbar); the docs themselves are MDX.
const en = {
  tagline: 'A VPN client for Android, Windows, Linux and OpenWrt routers, made for the We1ssBoard panel',
  documentation: 'Documentation',
  panelDocs: 'We1ssBoard docs',
  download: 'Download',
  getStarted: 'Get started',
  routerTitle: 'On an OpenWrt router',
  routerText: 'One command over SSH installs the client for OpenWrt 24.10 and 25.12:',
  copy: 'Copy',
  copied: 'Copied',
  features: [
    ['Every device', 'Android, Windows, Linux and OpenWrt routers with the same servers, balancer and look.'],
    ['Auto by delay', 'Picks the fastest server, steps around one that stops answering; pinning needs no reconnect.'],
    ['Routing', 'Per app on the phone; by lists, per device and through VPN interfaces on the router.'],
    ['We1ssBoard subscriptions', 'Traffic and expiry from the panel, auto-update, share links and QR codes.'],
    ['Exit IP and speed', 'The country, city and ISP you exit through, live speed and traffic.'],
    ['Against blocking', 'Reality, Vision, TLS fragmentation, DNS over HTTPS, the Reality fix for Xray 26.9.8+.'],
  ] as [string, string][],
};

const ru: typeof en = {
  tagline: 'VPN-клиент для Android, Windows, Linux и роутеров OpenWrt, сделанный для панели We1ssBoard',
  documentation: 'Документация',
  panelDocs: 'Документация We1ssBoard',
  download: 'Скачать',
  getStarted: 'Начать',
  routerTitle: 'На роутере OpenWrt',
  routerText: 'Одна команда по SSH ставит клиент для OpenWrt 24.10 и 25.12:',
  copy: 'Скопировать',
  copied: 'Скопировано',
  features: [
    ['Все устройства', 'Android, Windows, Linux и роутеры OpenWrt с одними серверами, балансировщиком и оформлением.'],
    ['Авто по задержке', 'Выбирает самый быстрый сервер и обходит упавший; закрепление сервера без переподключения.'],
    ['Маршрутизация', 'По приложениям на телефоне; по спискам, по устройствам и через VPN-интерфейсы на роутере.'],
    ['Подписки We1ssBoard', 'Трафик и срок из панели, автообновление, ссылки на ключи и QR-коды.'],
    ['Внешний IP и скорость', 'Страна, город и провайдер, через которые вы вышли в сеть, скорость и трафик вживую.'],
    ['Против блокировок', 'Reality, Vision, фрагментация TLS, DNS через HTTPS, исправление Reality для Xray 26.9.8+.'],
  ],
};

export function messages(lang: string) {
  return (lang as Locale) === 'ru' ? ru : en;
}
