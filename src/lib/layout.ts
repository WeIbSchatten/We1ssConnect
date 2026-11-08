import { useWindowDimensions, type ViewStyle } from 'react-native';

/** Text and cards stop growing past this width; wider screens centre the column. */
export const CONTENT_MAX = 720;

/**
 * Tablets in landscape and wide desktop windows get the connect button and the cards side by
 * side; phones, and tablets held upright, keep one column.
 */
export function homeColumns(width: number, height: number): 1 | 2 {
  return width >= 860 && width > height ? 2 : 1;
}

export function useHomeColumns(): 1 | 2 {
  const { width, height } = useWindowDimensions();
  return homeColumns(width, height);
}

/** contentContainerStyle of a page: full width up to CONTENT_MAX, centred beyond it. */
export const column: ViewStyle = { width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center' };
