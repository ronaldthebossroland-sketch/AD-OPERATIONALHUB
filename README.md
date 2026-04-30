# AD Operational Hub

AD Operational Hub is a Vite React frontend with an Express/Supabase backend.

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

The Android wrapper uses Capacitor and keeps the existing web deployment intact.

Capacitor app settings:

- App name: `AD Operational Hub`
- App ID: `com.adoperationalhub.app`
- Web directory: `dist`
- Live URL: `https://ad-operationalhub-seven.vercel.app`
- Backend API URL for production web builds: `https://ad-operationalhub.onrender.com`

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
