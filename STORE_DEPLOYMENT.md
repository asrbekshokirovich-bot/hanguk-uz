# Store Deployment Guide for Hanguk Consulting

This guide covers deploying the Hanguk Consulting app to the Apple App Store and Google Play Store via Despia.

## App Information

- **App ID**: `app.lovable.2617257ec6a04580a867dd529163ba02`
- **App Name**: Hanguk Consulting (koryo-guide-ai)
- **Category**: Education
- **Age Rating**: 4+

---

## Prerequisites

### General Requirements
- Node.js 18+ installed
- Git access to the repository
- Despia account for app store submissions

### For iOS
- macOS with Xcode 15+ installed
- Apple Developer Account ($99/year)
- Valid provisioning profiles and certificates

### For Android
- Android Studio installed
- JDK 17+ installed
- Google Play Developer Account ($25 one-time)
- Keystore for signing APKs

---

## Step 1: Export and Clone Repository

1. In Lovable, go to **Settings → GitHub → Export to GitHub**
2. Clone the repository locally:
   ```bash
   git clone <your-github-repo-url>
   cd <repo-name>
   ```

---

## Step 2: Install Dependencies

```bash
npm install
```

---

## Step 3: Add Native Platforms

### Add iOS
```bash
npx cap add ios
```

### Add Android
```bash
npx cap add android
```

---

## Step 4: Build and Sync

```bash
# Build the web app
npm run build

# Sync to native platforms
npx cap sync
```

---

## Step 5: App Icons and Splash Screens

### Required Icon Sizes

**Base Icon**: Create a `1024x1024` PNG image without transparency for App Store.

#### iOS Icons (place in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`)
- 20x20 @1x, @2x, @3x
- 29x29 @1x, @2x, @3x
- 40x40 @1x, @2x, @3x
- 60x60 @2x, @3x
- 76x76 @1x, @2x
- 83.5x83.5 @2x
- 1024x1024 @1x (App Store)

#### Android Icons (place in `android/app/src/main/res/`)
- mipmap-mdpi: 48x48
- mipmap-hdpi: 72x72
- mipmap-xhdpi: 96x96
- mipmap-xxhdpi: 144x144
- mipmap-xxxhdpi: 192x192

### Splash Screen

Create a `2732x2732` PNG with:
- Background color: `#1e3a5f`
- Centered Hanguk logo
- Safe zone: center 1200x1200 area

---

## Step 6: iOS Deployment

### Open in Xcode
```bash
npx cap open ios
```

### Configure Signing
1. Select the project in Xcode
2. Go to **Signing & Capabilities**
3. Select your Team
4. Set Bundle Identifier: `app.lovable.2617257ec6a04580a867dd529163ba02`

### Archive and Upload
1. Select **Product → Archive**
2. Click **Distribute App**
3. Choose **App Store Connect**
4. Upload to App Store Connect

### Via Despia
Upload the generated `.ipa` file to Despia for App Store submission.

---

## Step 7: Android Deployment

### Open in Android Studio
```bash
npx cap open android
```

### Generate Signed APK/AAB

1. Go to **Build → Generate Signed Bundle / APK**
2. Choose **Android App Bundle** for Play Store
3. Create or select your keystore:
   ```bash
   keytool -genkey -v -keystore release-key.keystore -alias hanguk -keyalg RSA -keysize 2048 -validity 10000
   ```
4. Fill in keystore details
5. Build the release bundle

### Via Despia
Upload the generated `.aab` file to Despia for Google Play submission.

---

## Step 8: Store Metadata

See `STORE_METADATA.md` for complete multi-language store descriptions (English, Uzbek, Russian, Korean).

### Quick Reference

**App Name**: Hanguk Consulting
**Subtitle**: Study in South Korea
**Category**: Education
**Age Rating**: 4+

**Keywords**: korea, university, study abroad, education, application, student, scholarship, korean language, admission, visa

**URLs**:
- Privacy Policy: https://koryo-guide-ai.lovable.app/privacy
- Terms of Service: https://koryo-guide-ai.lovable.app/terms
- Support: https://koryo-guide-ai.lovable.app

### Generated Assets

| Asset | Location |
|-------|----------|
| App Icon (1024×1024) | `public/icon-1024.png` |
| Splash Screen | `public/splash-2732.png` |
| iOS Screenshots (6) | `public/screenshots/ios-*.png` |
| Android Screenshots (6) | `public/screenshots/android-*.png` |

### Screenshot Order
1. Welcome - First impression
2. Login - Easy access
3. Dashboard - Application tracking
4. Map - University exploration
5. Interview - AI practice
6. Languages - Multi-language support

---

## Step 9: Screenshots

### Required Dimensions

**iOS**:
- 6.5" iPhone: 1284 x 2778 px
- 5.5" iPhone: 1242 x 2208 px
- 12.9" iPad: 2048 x 2732 px

**Android**:
- Phone: 1080 x 1920 px minimum
- Tablet 7": 1200 x 1920 px
- Tablet 10": 1920 x 1200 px

### Recommended Screenshots
1. Home/Dashboard view
2. University map
3. Application tracker
4. Document upload
5. AI chat/Interview practice
6. Multi-language support showcase

---

## Step 10: Testing Before Submission

### iOS TestFlight
1. Upload build to App Store Connect
2. Add internal/external testers
3. Distribute via TestFlight

### Android Internal Testing
1. Upload to Google Play Console
2. Create internal testing track
3. Add testers via email

---

## Important Notes

### Live Reload During Development
The app is configured to load from the Lovable preview URL during development:
```typescript
server: {
  url: 'https://2617257e-c6a0-4580-a867-dd529163ba02.lovableproject.com?forceHideBadge=true',
  cleartext: true
}
```

### For Production Release
Before submitting to app stores, update `capacitor.config.ts`:
```typescript
// Remove or comment out the server config for production
// server: {
//   url: '...',
//   cleartext: true
// }
```

This will make the app use the bundled web assets instead of loading from a remote URL.

---

## Troubleshooting

### iOS Build Fails
- Ensure Xcode Command Line Tools are installed
- Check that CocoaPods is installed: `sudo gem install cocoapods`
- Run `npx cap sync ios` after any changes

### Android Build Fails
- Ensure JAVA_HOME is set correctly
- Sync Gradle files in Android Studio
- Run `npx cap sync android` after any changes

### App Crashes on Launch
- Check console logs in Xcode/Android Studio
- Ensure all native plugins are properly installed
- Verify capacitor.config.ts settings

---

## Support

For deployment assistance, contact support@hanguk.consulting
