import { Platform } from "react-native";

export const palettes = {
  dark: {
    mode: "dark",
    isDark: true,
    bg: "#060B18",
    bgTop: "#0B1530",
    bgDeep: "#030712",
    surface: "#111E38",
    surfaceRaised: "#162645",
    surfaceSoft: "#1D3158",
    card: "rgba(17, 30, 56, 0.82)",
    cardElevated: "rgba(22, 38, 69, 0.9)",
    glassSurface: "rgba(17, 30, 56, 0.58)",
    glassSurfaceElevated: "rgba(22, 38, 69, 0.72)",
    glassHighlight: "rgba(255, 255, 255, 0.16)",
    glassSheen: "rgba(255, 255, 255, 0.08)",
    glassButton: "rgba(56, 189, 248, 0.14)",
    glassBorder: "rgba(255, 255, 255, 0.16)",
    glassBorderStrong: "rgba(125, 211, 252, 0.38)",
    input: "rgba(255, 255, 255, 0.05)",
    inputStrong: "rgba(17, 30, 56, 0.86)",
    chip: "rgba(29, 49, 88, 0.62)",
    nav: "rgba(9, 18, 37, 0.94)",
    navActive: "rgba(56, 189, 248, 0.1)",
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
    shadow: "#38BDF8",
    glowTop: "rgba(56, 189, 248, 0.16)",
    glowBottom: "rgba(124, 58, 237, 0.1)",
    gradient: ["#0B1530", "#060B18", "#030712"],
    statusBar: "light-content",
  },
  light: {
    mode: "light",
    isDark: false,
    bg: "#F9FAFB",
    bgTop: "#FFFFFF",
    bgDeep: "#EEF2FF",
    surface: "#FFFFFF",
    surfaceRaised: "#F1F5F9",
    surfaceSoft: "#E5E7EB",
    card: "rgba(255, 255, 255, 0.94)",
    cardElevated: "rgba(255, 255, 255, 0.98)",
    glassSurface: "rgba(255, 255, 255, 0.66)",
    glassSurfaceElevated: "rgba(255, 255, 255, 0.82)",
    glassHighlight: "rgba(255, 255, 255, 0.92)",
    glassSheen: "rgba(37, 99, 235, 0.08)",
    glassButton: "rgba(37, 99, 235, 0.1)",
    glassBorder: "rgba(37, 99, 235, 0.16)",
    glassBorderStrong: "rgba(37, 99, 235, 0.34)",
    input: "rgba(241, 245, 249, 0.88)",
    inputStrong: "rgba(255, 255, 255, 0.96)",
    chip: "rgba(239, 246, 255, 0.9)",
    nav: "rgba(255, 255, 255, 0.96)",
    navActive: "rgba(37, 99, 235, 0.1)",
    border: "rgba(15, 23, 42, 0.1)",
    borderStrong: "rgba(37, 99, 235, 0.28)",
    text: "#111827",
    textSoft: "#475569",
    textMuted: "#94A3B8",
    electric: "#2563EB",
    blue: "#2563EB",
    violet: "#7C3AED",
    high: "#E11D48",
    amber: "#D97706",
    green: "#059669",
    white: "#FFFFFF",
    shadow: "#2563EB",
    glowTop: "rgba(37, 99, 235, 0.1)",
    glowBottom: "rgba(124, 58, 237, 0.08)",
    gradient: ["#FFFFFF", "#F9FAFB", "#EEF2FF"],
    statusBar: "dark-content",
  },
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

export function createType(colors) {
  return {
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
}

export function createShadows(colors) {
  return {
    card: {
      shadowColor: colors.shadow,
      shadowOpacity: Platform.OS === "ios" ? 0.16 : 0.22,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 14 },
      elevation: 10,
    },
    glow: {
      shadowColor: colors.shadow,
      shadowOpacity: Platform.OS === "ios" ? 0.28 : 0.34,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 12 },
      elevation: 16,
    },
  };
}

export function makeTheme(mode = "dark") {
  const colors = palettes[mode] || palettes.dark;
  return {
    colors,
    spacing,
    radii,
    type: createType(colors),
    shadows: createShadows(colors),
  };
}

export const colors = palettes.dark;
export const type = createType(colors);
export const shadows = createShadows(colors);
