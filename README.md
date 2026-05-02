# Executive Virtual AI Assistant

Executive Virtual AI Assistant is a Vite React frontend with an Express/Supabase backend.

## Web Deployment

Vercel frontend:

- Root Directory: `./`
- Framework: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

Render backend:

- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `node server.js`

## Android APK With Capacitor

The Android wrapper uses Capacitor and bundles the production web build into the
APK. API requests still go to the Render backend.

Capacitor app settings:

- App name: `Executive Virtual AI Assistant`
- App ID: `com.adoperationalhub.app`
- Web directory: `dist`
- Backend API URL for production web builds: `https://ad-operationalhub.onrender.com`
- Optional live-server dev mode: set `CAPACITOR_LIVE_SERVER=true` before
  running `npx cap sync android`
- Optional system Clock alarms: set `VITE_ENABLE_SYSTEM_CLOCK_ALARMS=true`
  before building if you want Android Clock alarms in addition to app
  notifications. By default the APK uses cancellable local notifications.

No backend API keys or service role secrets belong in the Android or React app.

## Rebuild Android App

From the repo root:

```bash
npm install
npm run build
npx cap sync android
```

## Open Android Studio

```bash
npx cap open android
```

If Capacitor cannot find Android Studio, install Android Studio and set:

```powershell
$env:CAPACITOR_ANDROID_STUDIO_PATH="C:\Path\To\studio64.exe"
```

Then run:

```bash
npx cap open android
```

## Generate Debug APK

After Android Studio and the Android SDK are installed:

```bash
cd android
.\gradlew assembleDebug
```

The debug APK will be generated at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```
