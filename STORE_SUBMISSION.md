# FamKids — App Store Submission Checklist

## Apple App Store Connect

### Required Before Submission

#### App Information
- [ ] App Name: **FamKids — Family Parental Control**
- [ ] Subtitle (30 chars): **Screen Time & Safety Hub**
- [ ] Category: **Primary:** Utilities → Parental Controls · **Secondary:** Lifestyle
- [ ] Content Rating: **4+** (no objectionable content — parental control app)
- [ ] Age Rating Answers:
  - No cartoon/fantasy violence
  - No realistic violence
  - No sexual content
  - No profanity
  - No alcohol/tobacco/drugs
  - No gambling
  - No horror/fear themes
  - **Made for Kids:** NO — app is for parents (age 18+)
- [ ] Privacy Policy URL: **https://famkids.app/privacy**
- [ ] Support URL: **https://famkids.app/support**
- [ ] Marketing URL: **https://famkids.app**

#### App Description (4000 chars max)
```
FamKids is the all-in-one family management and parental control app that keeps your children safe, organized, and motivated — while giving you complete peace of mind.

SCREEN TIME & APP CONTROL
• Set daily screen time limits per child
• Block, limit, or earn-to-unlock specific apps
• Create Downtime Windows for school and bedtime
• Enable Free Mode for total usage reports with no limits
• Study Mode blocks entertainment apps during homework time

REAL-TIME MONITORING
• GPS location map with Safe Zone alerts
• Per-app usage reports (requires Android Usage Access)
• Foreground app detection (requires Accessibility Service)
• Camera Watch — turn the child's device into a live monitor
• SOS emergency button with GPS location push notification

CHORES & REWARDS
• Create and assign chores with photo proof
• Behavior points system with Time Bank bonus minutes
• AI-powered Reward Shop — kids spend points on real prizes
• Recurring chore schedules with automatic reminders

SCHOOL MANAGEMENT
• Homework assignments with due-date push notification reminders
• GPA tracking with automatic grade trend charts
• Grade rewards — bonus screen time for A/B grades
• Behavior event log with positive/negative point adjustments

FAMILY FEATURES
• AI Buddy chat powered by DeepSeek (OpenRouter) — age-safe
• Parent AI Agent — ask natural language questions about your family
• Family messaging and shared photo album
• Stories with voice narration, Life Advice board
• Memories scrapbook and Wish List

SAFETY & CONTROLS
• 4-digit parent PIN with recovery code
• Co-parent accounts with role-based access (Admin/Co-parent/Viewer)
• Remote lock with custom message and fun photo
• Voice commands via Google Assistant / Siri Shortcuts
• App overlay lock for blocked apps (Android)

PRIVACY FIRST
• All data stays on your device — no cloud servers required
• Optional Google Drive backup to your own account
• No ads, no data selling, no third-party analytics
• Full COPPA, GDPR, and CCPA compliance

REQUIRES (Android): Usage Access and Accessibility Service for app monitoring features. These can be granted in device Settings. Tap "Help & Privacy" in the app for full details.
```

#### Keywords (100 chars)
```
parental control,screen time,family,kids,chores,location,monitor,safety,app blocker,rewards
```

#### What's New (4000 chars)
```
Version 1.0 — Initial Release
• Complete parental control suite
• AI Buddy chat for kids powered by DeepSeek
• GPS location with Safe Zones
• Screen time limits and app blocking
• Chores, rewards, and behavior points
• School grade tracking with GPA
• Reward Shop — kids spend points on real prizes
• SOS emergency button
• Study Mode
• Dark mode support
• Privacy Policy built into the app
```

### App Privacy — Nutrition Label (App Store Connect)
Fill in "App Privacy" section with:

#### Data Used to Track You
- **None** — Check "We do not track users"

#### Data Linked to You
| Data Type | Category | Purpose |
|---|---|---|
| Name | Contact Info | App Functionality |
| Photos or Videos | User Content | App Functionality |
| Other User Content (journals, drawings) | User Content | App Functionality |
| Precise Location | Location | App Functionality |
| Other Usage Data (screen time) | Usage Data | App Functionality |
| Other Financial Info (piggy bank) | Financial Info | App Functionality |
| Health & Fitness | Health & Fitness | App Functionality |
| Browsing History (safe browser) | Browsing History | App Functionality |
| Other Identifiers (Google account) | Identifiers | App Functionality |

#### Data NOT Linked to You
- Crash Data → Diagnostics (if crash reporting enabled)

### Screenshots Required
- [ ] iPhone 6.9" (iPhone 16 Pro Max): 1320×2868
- [ ] iPhone 6.7" (iPhone 14 Plus): 1284×2778
- [ ] iPhone 5.5" (iPhone 8 Plus): 1242×2208
- [ ] iPad Pro 13" (M4): 2064×2752
- [ ] iPad Pro 12.9" (3rd gen): 2048×2732

### App Review Information
- [ ] Demo account credentials (parent PIN: 1234 for review)
- [ ] Notes: "This is a parental control app. The parent side requires a 4-digit PIN. Use PIN 1234 to access all features. The Android Accessibility Service and Usage Access permissions must be manually granted in device Settings — instructions are shown in the app's Help & Privacy screen."
- [ ] Review Notes attachment: Record a screen capture showing the permission setup flow

---

## Google Play Console

### Required Before Submission

#### Store Listing
- [ ] **App Name:** FamKids — Family Parental Control (50 chars max)
- [ ] **Short Description (80 chars):** Screen time limits, app blocking, location, chores & rewards for families
- [ ] **Full Description (4000 chars):** (use same as Apple above, adapted)
- [ ] **Category:** Tools → Parental Controls
- [ ] **Tags:** parental control, family safety, screen time, kids, chores
- [ ] **Content Rating:** Complete IARC questionnaire → Expected rating: **Everyone / PEGI 3**
- [ ] **Privacy Policy URL:** https://famkids.app/privacy
- [ ] **Email:** support@famkids.app
- [ ] **Website:** https://famkids.app

#### Data Safety Section (Play Console → App content → Data safety)

**Does your app collect or share any of the required user data types?** YES

| Data Type | Collected | Shared | Optional | Encrypted | Deleted on request |
|---|---|---|---|---|---|
| Name | Yes | No | No | Yes (local) | Yes |
| Email address | Optional | No | Yes | Yes | Yes |
| Photos and videos | Yes | No (user's Drive only) | Yes | Yes | Yes |
| Audio files | Yes | No | Yes | Yes | Yes |
| Precise location | Yes | No | Yes | Yes | Yes |
| Approximate location | Yes | No | Yes | Yes | Yes |
| Contacts | Yes | No | Yes | Yes | Yes |
| App interactions | Yes | No | No | Yes | Yes |
| App info and performance | Yes | No | No | Yes | Yes |
| Financial info | Yes | No | Yes | Yes | Yes |
| Health and fitness | Yes | No | Yes | Yes | Yes |

**Purposes for data collection:**
- App functionality (all types)
- Analytics (screen time only — stays local)

**Is data shared with third parties?**
- OpenRouter API: AI chat messages (encrypted, for AI responses via DeepSeek)
- Google Drive API: Backup files to user's own Google account only

**Security practices:**
- [x] Data is encrypted in transit (HTTPS/TLS)
- [x] You provide a way for users to request data deletion
- [x] App follows the Families Policy

#### Sensitive Permissions — Required Declarations

**BIND_ACCESSIBILITY_SERVICE**
- [ ] In Play Console → App content → Accessibility Service declaration:
  - "FamKids uses Android Accessibility Service to detect which app is currently in the foreground. This is used exclusively to enforce parental app blocking rules — when a child opens a blocked app, an overlay lock screen is shown. FamKids does NOT read the content, text, or data of any other app. It only reads the foreground app package name."

**PACKAGE_USAGE_STATS**
- [ ] In Play Console → App content → Prominent disclosure:
  - "FamKids reads app usage statistics (which apps were used and for how long) using Android's UsageStatsManager. This data is used to generate parental screen time reports and enforce daily app time limits. All data stays on the device and is never transmitted to our servers. This permission must be granted manually in Settings → Special App Access → Usage Access."

**SYSTEM_ALERT_WINDOW**
- [ ] In Play Console → App content → Prominent disclosure:
  - "FamKids displays an overlay lock screen using the 'Display over other apps' permission. This is used only to show a lock overlay when a child opens a blocked app or when a parent activates Remote Lock. The overlay cannot capture screen content from other apps. It can be revoked at any time in Settings → Apps → FamKids → Display over other apps."

#### Family Policy Compliance
- [ ] Does app target children under 13? **NO** — app targets parents (18+)
- [ ] Does the child-facing side have ads? **NO**
- [ ] Does the child-facing side have in-app purchases? **NO**
- [ ] Does the child-facing side share data with third parties? **Only Anthropic API for AI Buddy (encrypted)**
- [ ] Families Policy declaration: "FamKids is a parental control app. The child-facing interface does not display advertisements, does not request unnecessary permissions from the child, and does not facilitate purchases. All dangerous permissions are requested in the parent interface only."

#### Screenshots Required
- [ ] Phone: Min 2, max 8 screenshots (1080×1920 or 1440×2560)
- [ ] 7-inch tablet: Min 2 screenshots (optional but recommended)
- [ ] 10-inch tablet: Min 2 screenshots (optional but recommended)
- [ ] Feature Graphic: 1024×500 px

#### App Bundle
- [ ] Build with `eas build --platform android --profile production`
- [ ] Sign with production keystore (keep keystore file safe — cannot recover)
- [ ] Target SDK 35
- [ ] Minimum SDK 26 (Android 8.0+)

---

## Pre-Submission App Improvements Checklist

### Required for App Store Approval
- [ ] **Privacy Manifest (iOS 17+):** Add PrivacyInfo.xcprivacy for any privacy-sensitive APIs used by dependencies (NSUserDefaults, file timestamp, disk space, active keyboard, system boot time). Run `npx expo prebuild` and check `ios/FamKids/PrivacyInfo.xcprivacy`.
- [ ] **App Review demo video:** Record a 30-second screen capture showing the onboarding flow, parent PIN setup, and child profile creation.
- [ ] **Real device testing:** Must test on a physical Android device for Accessibility Service, Usage Access, and overlay features — these do not work in emulators.
- [ ] **App icon:** Replace placeholder `assets/icon.png` with 1024×1024 non-transparent PNG (no rounded corners — Apple adds them).
- [ ] **Splash screen:** Replace placeholder `assets/splash-icon.png` with branded design.
- [ ] **Privacy Policy webpage:** Host the privacy policy at https://famkids.app/privacy (required by both stores — cannot be a PDF or in-app only).

### Required for Play Store Approval
- [ ] **Prominent disclosure dialogs:** Before requesting Accessibility Service and Usage Access, show a user-facing dialog (Alert) explaining exactly what the permission is for and that it is required for app blocking. Add these in `app/parent/(more)/permissions.tsx`.
- [ ] **google-services.json:** Add real `google-services.json` from Firebase Console (or remove `googleServicesFile` from app.json if not using Firebase).
- [ ] **APK/AAB signing:** Configure `eas.json` with a production profile using a dedicated keystore.

### Recommended for Both Stores
- [ ] **Onboarding screenshots:** Create polished screenshots showing the parent dashboard, kid home screen, reports chart, and chore approval flow.
- [ ] **Localization:** Add at least Spanish and French translations for the store listing (increases discoverability by ~40%).
- [ ] **Crash reporting:** Add Sentry or similar (opt-in) to catch crashes before they affect reviews.
- [ ] **App rating prompt:** Add `expo-store-review` to prompt satisfied parents for a review after 7 days or 3 chore approvals.
- [ ] **Terms of Service:** Host terms at https://famkids.app/terms in addition to the privacy policy.
- [ ] **Support email response:** Ensure support@famkids.app is monitored — both stores may email it during review.

---

## eas.json (for EAS Build)

```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": true,
      "ios": { "resourceClass": "m-medium" },
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@apple.id",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./play-store-key.json",
        "track": "internal"
      }
    }
  }
}
```
