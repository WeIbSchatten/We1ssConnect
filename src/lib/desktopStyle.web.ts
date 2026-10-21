// Windows has no colour country flags, so 🇫🇮 shows as the letters "FI". The flag-only
// Twemoji font is declared under a family name that comes before "Segoe UI" in the
// react-native-web font stack and covers nothing but the regional indicator letters,
// so every other character still falls through to the system font.
const platform = (window as unknown as { __WE1SS__?: { platform?: string } }).__WE1SS__?.platform ?? '';

if (platform.startsWith('windows')) {
  const style = document.createElement('style');
  style.textContent = `@font-face {
  font-family: BlinkMacSystemFont;
  src: url(/fonts/TwemojiCountryFlags.woff2) format('woff2');
  unicode-range: U+1F1E6-1F1FF, U+1F3F4, U+E0062-E007F;
  font-display: swap;
}`;
  document.head.appendChild(style);
}

export {};
