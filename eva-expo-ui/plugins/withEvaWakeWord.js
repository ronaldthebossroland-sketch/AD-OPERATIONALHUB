const { withAndroidManifest, withMainApplication, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const PACKAGE_DIR = "com/adoperationalhub/eva";
const KT_FILES = [
  "EvaWakeWordModule.kt",
  "EvaWakeWordPackage.kt",
  "EvaWakeWordService.kt",
];

// Step 1: Copy the three Kotlin source files into the generated android folder.
function withEvaWakeWordSources(config) {
  return withDangerousMod(config, [
    "android",
    (cfg) => {
      const srcDir = path.join(__dirname, "android");
      const destDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/java",
        PACKAGE_DIR
      );
      fs.mkdirSync(destDir, { recursive: true });
      for (const file of KT_FILES) {
        fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
      }
      return cfg;
    },
  ]);
}

// Step 2: Patch AndroidManifest.xml — add foreground service permissions and service declaration.
function withEvaWakeWordManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const app = manifest.application?.[0];
    if (!app) return cfg;

    // Ensure required foreground service permissions are present.
    const permissionsNeeded = [
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MICROPHONE",
    ];
    const existingPerms = (manifest["uses-permission"] || []).map(
      (p) => p.$?.["android:name"]
    );
    for (const perm of permissionsNeeded) {
      if (!existingPerms.includes(perm)) {
        manifest["uses-permission"] = manifest["uses-permission"] || [];
        manifest["uses-permission"].push({ $: { "android:name": perm } });
      }
    }

    // Add the EvaWakeWordService declaration if not already present.
    const services = app.service || [];
    const alreadyAdded = services.some(
      (s) => s.$?.["android:name"] === ".EvaWakeWordService"
    );
    if (!alreadyAdded) {
      services.push({
        $: {
          "android:name": ".EvaWakeWordService",
          "android:enabled": "true",
          "android:exported": "false",
          "android:foregroundServiceType": "microphone",
        },
      });
      app.service = services;
    }

    return cfg;
  });
}

// Step 3: Patch MainApplication.kt — register EvaWakeWordPackage with React Native.
function withEvaWakeWordMainApplication(config) {
  return withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;
    const registrationLine = "packages.add(EvaWakeWordPackage())";

    if (!src.includes(registrationLine)) {
      src = src.replace(
        "val packages = PackageList(this).packages",
        `val packages = PackageList(this).packages\n            ${registrationLine}`
      );
    }

    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = function withEvaWakeWord(config) {
  config = withEvaWakeWordSources(config);
  config = withEvaWakeWordManifest(config);
  config = withEvaWakeWordMainApplication(config);
  return config;
};
