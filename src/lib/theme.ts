import { useColorScheme } from 'react-native';

import { PALETTES, type Palette } from './palettes';

export type { Palette };

// The Ocean preset of the We1ssBoard panel.
export function usePalette(): Palette {
  return useColorScheme() === 'light' ? PALETTES.ocean.light : PALETTES.ocean.dark;
}
