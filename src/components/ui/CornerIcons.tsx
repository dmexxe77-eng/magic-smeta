import Svg, { Path, Rect } from 'react-native-svg';

export const InnerCornerIcon = ({ size = 18, color = '#16a34a' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 2 L4 22 L22 22" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <Rect x="7" y="13" width="7" height="7" fill={color} opacity="0.85" rx="1" />
  </Svg>
);

export const OuterCornerIcon = ({ size = 18, color = '#dc2626' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M2 11 L13 11 L13 22" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <Rect x="14" y="2" width="7" height="7" fill={color} opacity="0.85" rx="1" />
  </Svg>
);
