import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.adoperationalhub.app",
  appName: "AD Operational Hub",
  webDir: "dist",
  server: {
    url: "https://ad-operationalhub-seven.vercel.app",
    cleartext: false,
  },
};

export default config;
