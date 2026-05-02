import type { CapacitorConfig } from "@capacitor/cli";

const useLiveServer = process.env.CAPACITOR_LIVE_SERVER === "true";

const config: CapacitorConfig = {
  appId: "com.adoperationalhub.app",
  appName: "Executive Virtual AI Assistant",
  webDir: "dist",
  server: useLiveServer
    ? {
        url: "https://ad-operationalhub-seven.vercel.app",
        cleartext: false,
      }
    : {
        androidScheme: "https",
        cleartext: false,
      },
  plugins: {
    LocalNotifications: {
      iconColor: "#111827",
      sound: "executive_chime.wav",
    },
  },
};

export default config;
