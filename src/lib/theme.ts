import { useColorScheme } from 'react-native';

import { PALETTES, type Palette } from './palettes';
import { useStore } from './store';

export type { Palette };

/** Onest (OFL, drawn with Cyrillic in mind) for headings, the connection state and numbers. */
export const FONT = {
  regular: 'Onest_400Regular',
  medium: 'Onest_500Medium',
  semibold: 'Onest_600SemiBold',
  bold: 'Onest_700Bold',
};

/** The chosen colour preset (Ocean by default, as in the We1ssBoard panel) in the chosen mode. */
export function usePalette(): Palette {
  const scheme = useColorScheme();
  const { theme, style } = useStore((s) => s.settings);
  const preset = PALETTES[style] ?? PALETTES.ocean;
  const mode = theme === 'system' ? (scheme === 'light' ? 'light' : 'dark') : theme;
  return mode === 'light' ? preset.light : mode === 'amoled' ? preset.ultra : preset.dark;
}

/** Whether the screen is light, for the status bar icons. */
export function useIsLight(): boolean {
  const scheme = useColorScheme();
  const theme = useStore((s) => s.settings.theme);
  return theme === 'light' || (theme === 'system' && scheme === 'light');
}
