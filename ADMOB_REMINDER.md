# ⚠️ AdMob & Store Submission Checklist

**READ THIS BEFORE RUNNING `eas build` OR SUBMITTING TO EITHER STORE**

---

## 🔴 AdMob — NOT YET CONFIGURED

The app currently shows a placeholder banner (`components/ad-banner.tsx`).
You must complete all steps below before the real APK / IPA is built.

### Step 1 — Create AdMob Account & Ad Units
1. Go to https://admob.google.com and sign in / create account
2. Add your app: **Add App → Android** and **Add App → iOS**
3. Note your **App IDs** (format: `ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX`)
4. Create a **Banner Ad Unit** for each platform
5. Note your **Banner Ad Unit IDs** (format: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX`)

### Step 2 — Install the AdMob SDK
```bash
npx expo install react-native-google-mobile-ads
```

### Step 3 — Add App IDs to app.json
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX",
          "iosAppId":     "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"
        }
      ]
    ]
  }
}
```

### Step 4 — Update components/ad-banner.tsx
Replace the placeholder block with the real AdMob component:
```tsx
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

// Use TestIds.BANNER in dev, real unit ID in production
const BANNER_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : Platform.OS === "ios"
    ? "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"   // ← your iOS banner unit ID
    : "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX";  // ← your Android banner unit ID

// Replace the placeholder <View> with:
<BannerAd
  unitId={BANNER_UNIT_ID}
  size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
  requestOptions={{ requestNonPersonalizedAdsOnly: true }}
/>
```

### Step 5 — Wire up In-App Purchase (for the $19.99 ad-free option)
The `handleUpgrade()` function in `components/monetization-modal.tsx` currently
just logs a warning. Before release:
1. Install: `npx expo install expo-in-app-purchases` or `react-native-purchases` (RevenueCat)
2. Configure your product IDs in App Store Connect and Google Play Console:
   - Product ID: `com.famkids.app.adfree` (or similar)
   - Price: $19.99 one-time
3. Update `handleUpgrade()` to call your IAP flow
4. On successful purchase, dispatch:
   ```ts
   dispatch({ type: "SET_AD_FREE", purchasedAt: new Date().toISOString() });
   dispatch({ type: "AD_DISCLOSURE_SEEN" });
   onDismiss();
   ```

---

## 🍎 Apple App Store Checklist

- [ ] AdMob iOS App ID added to app.json (see above)
- [ ] Banner unit ID added to ad-banner.tsx
- [ ] IAP product created in App Store Connect (`com.famkids.app.adfree`)
- [ ] Privacy Nutrition Label updated in App Store Connect:
      - Add "Advertising Data" under "Data Used to Track You" if using personalized ads
      - If using `requestNonPersonalizedAdsOnly: true`, select "Data NOT Linked to You"
- [ ] App Review Notes: mention AdMob and note that kids side has ZERO ads
- [ ] Screenshot of ad banner taken from iOS Simulator for review
- [ ] `buildNumber` bumped in app.json before each TestFlight / release build
- [ ] `eas build --platform ios --profile production`
- [ ] `eas submit --platform ios`

---

## 🤖 Google Play Checklist

- [ ] AdMob Android App ID added to app.json (see above)
- [ ] Banner unit ID added to ad-banner.tsx
- [ ] IAP product created in Google Play Console (`com.famkids.app.adfree`)
- [ ] Data Safety section updated:
      - Add "Advertising IDs" → collected for showing ads (if using personalized ads)
      - Or mark "No advertising data collected" if using non-personalized only
- [ ] `versionCode` bumped in app.json before each build
- [ ] `eas build --platform android --profile production`
- [ ] `eas submit --platform android`

---

## 💡 Reminder — Ad Policy to Keep

| Location          | Ads?                          |
|-------------------|-------------------------------|
| Kid home screen   | ❌ NEVER — zero ads for kids  |
| Kid any screen    | ❌ NEVER                      |
| Parent dashboard  | ✅ One banner (top only)      |
| Parent other pages| ✅ Optional — tasteful only   |
| Ad-free purchasers| ❌ No ads anywhere            |

The `<AdBanner hidden={isAdFree} />` prop already handles hiding for paying users.
Make sure NO ad imports or renders are ever added to any file under `app/kid/`.

---

## 📞 Support & Ad Networks Contacts

- AdMob support: https://support.google.com/admob
- RevenueCat (IAP): https://www.revenuecat.com
- expo-in-app-purchases: https://docs.expo.dev/versions/v54.0.0/sdk/in-app-purchases/
- FamKids support email: support@famkids.app

---

*Last updated: 2026-05-26*
