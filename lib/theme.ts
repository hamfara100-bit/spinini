import { PastelColor, PASTEL_COLORS } from "./data/types";

export const Colors = {
  primary: "#7C5CFF",
  primaryLight: "#A78BFA",
  secondary: "#FFB347",
  success: "#34D399",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#60A5FA",

  bgLight: "#FAF7FF",
  bgDark: "#0E0B1F",
  background: "#FAF7FF",  // alias for bgLight
  surfaceLight: "#FFFFFF",
  surfaceDark: "#1A1633",
  cardLight: "#F3EEFF",
  cardDark: "#241D40",

  textPrimary: "#1A1033",
  textSecondary: "#6B5B9E",
  textLight: "#FFFFFF",
  textMuted: "#9CA3AF",

  border: "#E5E7EB",
  borderDark: "#2D2650",

  pastel: PASTEL_COLORS,
};

export function pastelHex(color: PastelColor): string {
  return PASTEL_COLORS[color];
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 16,
  md: 18,
  lg: 22,
  xl: 28,
  xxl: 36,
};

export const Shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#7C5CFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
};
