import { Platform } from "react-native";

export const colors = {
  bg: "#060B18",
  bgTop: "#0B1530",
  bgDeep: "#030712",
  surface: "#111E38",
  surfaceRaised: "#162645",
  surfaceSoft: "#1D3158",
  border: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(56, 189, 248, 0.3)",
  text: "#F8FAFC",
  textSoft: "#AAB7D4",
  textMuted: "#7180A6",
  electric: "#38BDF8",
  blue: "#2563EB",
  violet: "#7C3AED",
  high: "#FB7185",
  amber: "#FBBF24",
  green: "#34D399",
  white: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radii = {
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const type = {
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: colors.text,
  },
  h1: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "800",
    color: colors.text,
  },
  h2: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.text,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    color: colors.textSoft,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: colors.textMuted,
  },
  micro: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
};

export const shadows = {
  card: {
    shadowColor: colors.electric,
    shadowOpacity: Platform.OS === "ios" ? 0.16 : 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  glow: {
    shadowColor: colors.electric,
    shadowOpacity: Platform.OS === "ios" ? 0.38 : 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
};
