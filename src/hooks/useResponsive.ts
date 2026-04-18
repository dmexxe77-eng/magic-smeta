import { useWindowDimensions } from 'react-native';

/**
 * Tablet-aware responsive layout hook.
 * Returns style object to apply to main content containers.
 * On tablet (width >= 768): constrains content to max 720px, centered.
 * On phone: full width.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLandscape = width > height;

  return {
    isTablet,
    isLandscape,
    width,
    height,
    // Apply to main content View to constrain on tablet
    containerStyle: isTablet
      ? { maxWidth: 720, width: '100%' as const, alignSelf: 'center' as const }
      : { width: '100%' as const },
  };
}
