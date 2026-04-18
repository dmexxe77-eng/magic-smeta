import { useWindowDimensions } from 'react-native';

/**
 * Tablet-aware responsive layout hook.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLandscape = width > height;
  const numColumns = isTablet ? 2 : 1;

  return {
    isTablet,
    isLandscape,
    width,
    height,
    numColumns,
    // Full width, just flex
    containerStyle: { flex: 1, width: '100%' as const },
  };
}
