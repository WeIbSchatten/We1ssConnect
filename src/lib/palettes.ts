// Pure palette data shared by the web panel (useTheme) and the mobile app; mirrors
// styles/theme.css because antd and React Native need literal colours.
export type StylePreset = 'mono' | 'pastel' | 'ocean' | 'emerald';
export const STYLE_PRESETS: StylePreset[] = ['mono', 'pastel', 'ocean', 'emerald'];

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  elevated: string;
  border: string;
  borderStrong: string;
  text: string;
  text2: string;
  text3: string;
  accent: string;
  accentHover: string;
  accentActive: string;
  onAccent: string;
  accentSoft: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  chart: [string, string, string];
}

const DARK: Palette = {
  bg: '#0a0a0a',
  surface: '#141414',
  surface2: '#1b1b1b',
  elevated: '#1a1a1a',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  text: '#f5f5f5',
  text2: '#b4b4b4',
  text3: '#8f8f8f',
  accent: '#f5f5f5',
  accentHover: '#ffffff',
  accentActive: '#d9d9d9',
  onAccent: '#0a0a0a',
  accentSoft: 'rgba(255, 255, 255, 0.08)',
  success: '#7dcea0',
  warning: '#e2b86b',
  error: '#ec7a7a',
  info: '#9db8db',
  chart: ['#f5f5f5', '#9db8db', '#e2b86b'],
};

const ULTRA: Palette = {
  ...DARK,
  bg: '#000000',
  surface: '#0a0a0a',
  surface2: '#111111',
  elevated: '#0f0f0f',
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
};

const LIGHT: Palette = {
  bg: '#f3f3f2',
  surface: '#ffffff',
  surface2: '#f4f4f3',
  elevated: '#ffffff',
  border: 'rgba(0, 0, 0, 0.08)',
  borderStrong: 'rgba(0, 0, 0, 0.15)',
  text: '#111111',
  text2: '#4d4d4d',
  text3: '#666666',
  accent: '#111111',
  accentHover: '#2b2b2b',
  accentActive: '#000000',
  onAccent: '#ffffff',
  accentSoft: 'rgba(0, 0, 0, 0.05)',
  success: '#1f7a45',
  warning: '#8a5a10',
  error: '#b3362f',
  info: '#33608f',
  chart: ['#111111', '#33608f', '#8a5a10'],
};

// Pastel: lemon / pink / lilac / navy on near-black graphite or lavender paper.
const PASTEL_DARK: Palette = {
  bg: '#0b0b0d',
  surface: '#19191c',
  surface2: '#222226',
  elevated: '#1f1f23',
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.13)',
  text: '#f4f3fa',
  text2: '#bdbbcf',
  text3: '#918fa6',
  accent: '#a8a3f6',
  accentHover: '#bcb8f9',
  accentActive: '#938dec',
  onAccent: '#16163a',
  accentSoft: 'rgba(168, 163, 246, 0.14)',
  success: '#8fd8ae',
  warning: '#f8ffa1',
  error: '#ff8fa3',
  info: '#a9c0ff',
  chart: ['#a8a3f6', '#f6d5ee', '#f8ffa1'],
};

const PASTEL_ULTRA: Palette = {
  ...PASTEL_DARK,
  bg: '#000000',
  surface: '#111113',
  surface2: '#18181b',
  elevated: '#151518',
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
};

const PASTEL_LIGHT: Palette = {
  bg: '#f4f3fb',
  surface: '#ffffff',
  surface2: '#efeef9',
  elevated: '#ffffff',
  border: 'rgba(36, 49, 107, 0.10)',
  borderStrong: 'rgba(36, 49, 107, 0.18)',
  text: '#16163a',
  text2: '#45456a',
  text3: '#5e5e80',
  accent: '#24316b',
  accentHover: '#2f3e85',
  accentActive: '#1a2452',
  onAccent: '#ffffff',
  accentSoft: 'rgba(168, 163, 246, 0.22)',
  success: '#1f7a45',
  warning: '#7d6a00',
  error: '#b3364f',
  info: '#3a4fb0',
  chart: ['#24316b', '#8b84ee', '#c25a9f'],
};

// Ocean: a clear blue accent on blue-tinted graphite or cool paper.
const OCEAN_DARK: Palette = {
  bg: '#0a0d14',
  surface: '#121722',
  surface2: '#19202d',
  elevated: '#161c28',
  border: 'rgba(148, 180, 255, 0.08)',
  borderStrong: 'rgba(148, 180, 255, 0.15)',
  text: '#eef2fa',
  text2: '#aeb8cc',
  text3: '#8591a8',
  accent: '#2f74ff',
  accentHover: '#4b88ff',
  accentActive: '#1f5fe0',
  onAccent: '#ffffff',
  accentSoft: 'rgba(47, 116, 255, 0.16)',
  success: '#6fd3a0',
  warning: '#e8bd6a',
  error: '#f07a7a',
  info: '#7fb0ff',
  chart: ['#2f74ff', '#7fb0ff', '#e8bd6a'],
};

const OCEAN_ULTRA: Palette = {
  ...OCEAN_DARK,
  bg: '#000000',
  surface: '#080b12',
  surface2: '#0e131c',
  elevated: '#0b1018',
  border: 'rgba(148, 180, 255, 0.07)',
  borderStrong: 'rgba(148, 180, 255, 0.13)',
};

const OCEAN_LIGHT: Palette = {
  bg: '#f2f5fb',
  surface: '#ffffff',
  surface2: '#eef2fa',
  elevated: '#ffffff',
  border: 'rgba(20, 40, 90, 0.09)',
  borderStrong: 'rgba(20, 40, 90, 0.16)',
  text: '#0e1a33',
  text2: '#3f4d68',
  text3: '#5b6884',
  accent: '#1f5fd6',
  accentHover: '#2c6ff0',
  accentActive: '#1a4fb3',
  onAccent: '#ffffff',
  accentSoft: 'rgba(31, 95, 214, 0.1)',
  success: '#1f7a45',
  warning: '#8a5a10',
  error: '#b3362f',
  info: '#1f5fd6',
  chart: ['#1f5fd6', '#5f8fe6', '#8a5a10'],
};

// Emerald: a fresh green accent on green-tinted graphite or mint paper.
const EMERALD_DARK: Palette = {
  bg: '#090c0b',
  surface: '#121715',
  surface2: '#19201d',
  elevated: '#161c19',
  border: 'rgba(160, 255, 210, 0.07)',
  borderStrong: 'rgba(160, 255, 210, 0.14)',
  text: '#edf5f1',
  text2: '#adbdb5',
  text3: '#85968e',
  accent: '#34d399',
  accentHover: '#52deab',
  accentActive: '#22b583',
  onAccent: '#04140d',
  accentSoft: 'rgba(52, 211, 153, 0.14)',
  success: '#34d399',
  warning: '#e8c06a',
  error: '#f07a7a',
  info: '#8ab8e0',
  chart: ['#34d399', '#8ab8e0', '#e8c06a'],
};

const EMERALD_ULTRA: Palette = {
  ...EMERALD_DARK,
  bg: '#000000',
  surface: '#080b0a',
  surface2: '#0e1311',
  elevated: '#0b0f0d',
  border: 'rgba(160, 255, 210, 0.06)',
  borderStrong: 'rgba(160, 255, 210, 0.12)',
};

const EMERALD_LIGHT: Palette = {
  bg: '#f2f6f4',
  surface: '#ffffff',
  surface2: '#edf3f0',
  elevated: '#ffffff',
  border: 'rgba(10, 60, 40, 0.09)',
  borderStrong: 'rgba(10, 60, 40, 0.16)',
  text: '#0c1f17',
  text2: '#3d5249',
  text3: '#586c63',
  accent: '#0f7a55',
  accentHover: '#138c62',
  accentActive: '#0b6646',
  onAccent: '#ffffff',
  accentSoft: 'rgba(15, 122, 85, 0.1)',
  success: '#1f7a45',
  warning: '#8a5a10',
  error: '#b3362f',
  info: '#2f6690',
  chart: ['#0f7a55', '#4fae8a', '#8a5a10'],
};

export const PALETTES: Record<StylePreset, { dark: Palette; ultra: Palette; light: Palette }> = {
  mono: { dark: DARK, ultra: ULTRA, light: LIGHT },
  pastel: { dark: PASTEL_DARK, ultra: PASTEL_ULTRA, light: PASTEL_LIGHT },
  ocean: { dark: OCEAN_DARK, ultra: OCEAN_ULTRA, light: OCEAN_LIGHT },
  emerald: { dark: EMERALD_DARK, ultra: EMERALD_ULTRA, light: EMERALD_LIGHT },
};
