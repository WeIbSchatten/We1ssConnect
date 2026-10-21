<div class="hero">
  <img src="assets/logo.svg" alt="We1ssConnect">
  <h1>We1ssConnect</h1>
  <p>Быстрый и аккуратный VPN-клиент для Android, Windows и Linux на ядре Xray</p>
  <a class="btn" href="https://github.com/WeIbSchatten/We1ssConnect/releases/latest">Скачать APK</a>
  <a class="btn ghost" href="#/ru/quickstart">Первое подключение</a>
</div>

We1ssConnect — клиент для серверов на Xray-core и, в первую очередь, для панели
[We1ssBoard](https://github.com/WeIbSchatten/We1ssBoard). Он подключается по подписке или по
ссылкам, сам выбирает самый быстрый сервер, показывает, через какую страну вы вышли в сеть, и
позволяет решить, какие приложения идут через VPN.

<div class="features">
  <div><b>Ядро Xray</b><span>VLESS (Reality, Vision, XHTTP), VMess, Trojan, Shadowsocks и Hysteria2. Ядро работает внутри приложения, без tun2socks и без открытых локальных портов.</span></div>
  <div><b>Пинг до и во время</b><span>Задержка до каждого сервера проверяется ещё до подключения и обновляется вживую, пока VPN включён.</span></div>
  <div><b>Автовыбор</b><span>Балансировщик берёт сервер с наименьшей задержкой или чередует живые серверы по кругу, а упавший сервер обходит сам.</span></div>
  <div><b>Ваш IP и страна</b><span>На главном экране видны внешний IP (середина скрыта), флаг страны, город и провайдер, а ещё скорость и трафик за сеанс.</span></div>
  <div><b>Маршрутизация по приложениям</b><span>Через VPN идут все приложения, только выбранные или все, кроме выбранных.</span></div>
  <div><b>Пресеты для России</b><span>Российские сайты можно пустить напрямую, а рекламу блокировать. Правила скачиваются сами.</span></div>
  <div><b>Против блокировок</b><span>Есть фрагментация TLS, mux, исправление Reality для Xray 26.9.8+, DNS через HTTPS и IPv6.</span></div>
  <div><b>Удобство</b><span>Добавление по QR-коду, плитка в шторке, автообновление подписок, обновление приложения прямо из него.</span></div>
  <div><b>Оформление</b><span>Тёмная, светлая и AMOLED-темы, цвета панели We1ssBoard, русский и английский язык.</span></div>
</div>

## С чего начать

1. [Установите приложение](/ru/install.md): скачайте APK со страницы релиза.
2. [Добавьте серверы](/ru/quickstart.md): ссылку на подписку из панели, ссылки на ключи или QR-код.
3. Нажмите большую кнопку на главном экране.

## Требования

| | |
| --- | --- |
| Android | 8.0 и новее |
| Компьютер | Windows 10/11 или Linux с WebKitGTK 4.1, 64 бит ([подробнее](/ru/desktop.md)) |
| Процессор | ARM64 (почти все телефоны) или ARMv7 (старые модели) |
| Место | до 100 МБ |
| Разрешения | VPN, уведомления; камера только для QR-кода |

> We1ssConnect распространяется бесплатно. Ядро — [Xray-core](https://github.com/XTLS/Xray-core)
> (MPL-2.0) и [libXray](https://github.com/XTLS/libXray) (MIT), подробности в
> [NOTICE.md](https://github.com/WeIbSchatten/We1ssConnect/blob/main/NOTICE.md).
