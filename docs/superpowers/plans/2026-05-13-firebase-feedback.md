# Firebase + User Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Firebase (App Check + Analytics + Cloud Functions) and wire `FeedbackDialog` from `@beitissieshapiro/issie-shared` into the Settings screen.

**Architecture:** Firebase is initialized natively (iOS AppDelegate + Android google-services plugin) and in JS via `firebaseInit()` from issie-shared. Because IssieAlbom has its own typed translation system, a bridge module (`issie-shared-lang.ts`) calls `initLang()` to feed the 15 feedback strings into issie-shared's internal `translate()` function. The feedback button lives in `SettingsScreen.tsx` and renders `FeedbackDialog` as a modal.

**Tech Stack:** `@react-native-firebase/app`, `/app-check`, `/functions`, `/analytics` (^23.8.6), `@beitissieshapiro/issie-shared` (^1.0.3), CocoaPods static frameworks, Android google-services plugin.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add Firebase + issie-shared npm deps |
| `ios/Podfile` | Modify | Add static frameworks flags required by RNFirebase |
| `ios/IssieAlbum/AppDelegate.swift` | Modify | Native Firebase init before RN startup |
| `android/build.gradle` | Modify | Add google-services classpath to buildscript |
| `android/app/build.gradle` | Modify | Apply google-services plugin + Firebase BOM |
| `src/common/debug-token.ts` | Create | App Check debug token (registered in Firebase console) |
| `src/firebase-config.ts` | Create | JS Firebase init wrapper using issie-shared |
| `src/issie-shared-lang.ts` | Create | Bridge: feed feedback strings into issie-shared's translate() |
| `index.js` | Modify | Call initIssieSharedLang() + initializeFirebase() at startup |
| `src/i18n/translations.ts` | Modify | Add `settings.feedback` key (EN/HE/AR) |
| `src/screens/SettingsScreen.tsx` | Modify | Add feedback button + FeedbackDialog |

---

## Task 1: Add npm dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add Firebase and issie-shared to package.json dependencies**

Open `package.json` and add to the `"dependencies"` object:

```json
"@react-native-firebase/app": "^23.8.6",
"@react-native-firebase/app-check": "^23.8.6",
"@react-native-firebase/functions": "^23.8.6",
"@react-native-firebase/analytics": "^23.8.6",
"@beitissieshapiro/issie-shared": "^1.0.3"
```

- [ ] **Step 2: Install dependencies**

```bash
yarn install
```

Expected: no errors, `node_modules/@react-native-firebase` and `node_modules/@beitissieshapiro/issie-shared` exist.

- [ ] **Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "feat: add react-native-firebase and issie-shared deps"
```

---

## Task 2: iOS native config — Podfile

**Files:**
- Modify: `ios/Podfile`

The current Podfile has a `USE_FRAMEWORKS` env-var block. RNFirebase requires static frameworks unconditionally — replace that block with an unconditional declaration and add the Firebase flags.

- [ ] **Step 1: Update Podfile**

Replace this block (lines ~30-34):
```ruby
linkage = ENV['USE_FRAMEWORKS']
if linkage != nil
  Pod::UI.puts "Configuring Pod with #{linkage}ally linked Frameworks".green
  use_frameworks! :linkage => linkage.to_sym
end
```

With:
```ruby
$RNFirebaseAsStaticFramework = true
$RNFirebaseAnalyticsWithoutAdIdSupport = true
use_frameworks! :linkage => :static
```

- [ ] **Step 2: Run pod install**

```bash
cd ios && bundle exec pod install && cd ..
```

Expected: pods resolve including `RNFBApp`, `RNFBAppCheck`, `RNFBFunctions`, `RNFBAnalytics`. No errors.

- [ ] **Step 3: Commit**

```bash
git add ios/Podfile ios/Podfile.lock
git commit -m "feat: configure Podfile for RNFirebase static frameworks"
```

---

## Task 3: iOS native config — AppDelegate

**Files:**
- Modify: `ios/IssieAlbum/AppDelegate.swift`

- [ ] **Step 1: Add Firebase imports**

At the top of `AppDelegate.swift`, after the existing imports, add:
```swift
import RNFBAppCheck
import FirebaseCore
import Firebase
```

- [ ] **Step 2: Call Firebase configure at launch**

Inside `application(_:didFinishLaunchingWithOptions:)`, add these two lines as the very first lines of the function body (before `let delegate = ReactNativeDelegate()`):
```swift
RNFBAppCheckModule.sharedInstance()
FirebaseApp.configure()
```

- [ ] **Step 3: Verify it builds**

```bash
cd ios && xcodebuild -workspace IssieAlbum.xcworkspace -scheme IssieAlbum -destination 'generic/platform=iOS Simulator' build 2>&1 | tail -5
```

Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 4: Commit**

```bash
git add ios/IssieAlbum/AppDelegate.swift
git commit -m "feat: initialize Firebase in iOS AppDelegate"
```

---

## Task 4: Android native config

**Files:**
- Modify: `android/build.gradle`
- Modify: `android/app/build.gradle`

- [ ] **Step 1: Add google-services classpath to root build.gradle**

In `android/build.gradle`, add to the `dependencies` block inside `buildscript`:
```groovy
classpath("com.google.gms:google-services:4.4.2")
```

After edit the `buildscript.dependencies` block looks like:
```groovy
dependencies {
    classpath("com.android.tools.build:gradle")
    classpath("com.facebook.react:react-native-gradle-plugin")
    classpath("org.jetbrains.kotlin:kotlin-gradle-plugin")
    classpath("com.google.gms:google-services:4.4.2")
}
```

- [ ] **Step 2: Apply plugin and add Firebase BOM to app build.gradle**

In `android/app/build.gradle`:

Add as the 4th line (after the existing 3 `apply plugin` lines):
```groovy
apply plugin: "com.google.gms.google-services"
```

Add to the `dependencies` block:
```groovy
implementation platform("com.google.firebase:firebase-bom:34.9.0")
implementation "com.google.firebase:firebase-analytics"
```

- [ ] **Step 3: Verify Android build**

```bash
cd android && ./gradlew assembleDebug 2>&1 | tail -10
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add android/build.gradle android/app/build.gradle
git commit -m "feat: configure Android for Firebase (google-services plugin + BOM)"
```

---

## Task 5: JS Firebase init files

**Files:**
- Create: `src/common/debug-token.ts`
- Create: `src/firebase-config.ts`

- [ ] **Step 1: Create debug-token.ts**

Create `src/common/debug-token.ts`:
```typescript
// Register this token in Firebase Console → App Check → Apps → Debug tokens
export const debugToken = 'REPLACE-WITH-YOUR-DEBUG-UUID';
```

To generate a UUID: `node -e "const {randomUUID}=require('crypto');console.log(randomUUID())"` — copy the output, paste as the value, then register it in the Firebase console under your app's App Check debug tokens.

- [ ] **Step 2: Create firebase-config.ts**

Create `src/firebase-config.ts`:
```typescript
import { firebaseInit } from '@beitissieshapiro/issie-shared';
import { debugToken } from './common/debug-token';

export function initializeFirebase(): void {
  firebaseInit(debugToken);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/common/debug-token.ts src/firebase-config.ts
git commit -m "feat: add JS Firebase init wrapper and debug token placeholder"
```

---

## Task 6: Language bridge for issie-shared

**Files:**
- Create: `src/issie-shared-lang.ts`

`FeedbackDialog` calls `translate("Key")` from issie-shared's internal lang module. IssieAlbom has its own translation system. This bridge feeds the 15 feedback strings into issie-shared so `translate()` resolves them correctly.

- [ ] **Step 1: Create issie-shared-lang.ts**

Create `src/issie-shared-lang.ts`:
```typescript
import { initLang } from '@beitissieshapiro/issie-shared';
import { getLocales } from 'react-native-localize';

const feedbackStrings = {
  he: {
    UserFeedback: 'משוב משתמש',
    Feedback: 'משוב',
    FeedbackTitleLabel: 'כותרת / נושא',
    FeedbackTitlePlaceholder: 'כותרת קצרה או נושא',
    FeedbackPlaceholder: 'שתפו אותנו במה שעל ליבכם...',
    EmailTitle: 'אימייל (אופציונלי)',
    EmailPlaceholder: 'your@email.com',
    BtnCancel: 'ביטול',
    BtnSubmitFeedback: 'שליחה',
    FeedbackSubmitted: 'תודה! המשוב נשלח בהצלחה',
    FeedbackError: 'שליחת המשוב נכשלה. נסו שוב.',
    TitleMinLength: 'הכותרת חייבת להכיל לפחות 3 תווים',
    TitleMaxLength: 'הכותרת חייבת להכיל פחות מ-100 תווים',
    FeedbackMinLength: 'המשוב חייב להכיל לפחות 5 תווים',
    FeedbackMaxLength: 'המשוב חייב להכיל פחות מ-1000 תווים',
    InvalidEmail: 'כתובת אימייל לא תקינה',
  },
  en: {
    UserFeedback: 'User Feedback',
    Feedback: 'Feedback',
    FeedbackTitleLabel: 'Title / Subject',
    FeedbackTitlePlaceholder: 'Enter a brief title or subject',
    FeedbackPlaceholder: 'Share your thoughts with us...',
    EmailTitle: 'Email (optional)',
    EmailPlaceholder: 'your@email.com',
    BtnCancel: 'Cancel',
    BtnSubmitFeedback: 'Submit',
    FeedbackSubmitted: 'Thank you! Your feedback was submitted successfully',
    FeedbackError: 'Failed to submit feedback. Please try again.',
    TitleMinLength: 'Title must be at least 3 characters',
    TitleMaxLength: 'Title must be less than 100 characters',
    FeedbackMinLength: 'Feedback must be at least 5 characters',
    FeedbackMaxLength: 'Feedback must be less than 1000 characters',
    InvalidEmail: 'Invalid email address',
  },
  ar: {
    UserFeedback: 'ملاحظات المستخدم',
    Feedback: 'ملاحظات',
    FeedbackTitleLabel: 'العنوان / الموضوع',
    FeedbackTitlePlaceholder: 'أدخل عنوانًا موجزًا أو موضوعًا',
    FeedbackPlaceholder: 'شارك أفكارك معنا...',
    EmailTitle: 'البريد الإلكتروني (اختياري)',
    EmailPlaceholder: 'your@email.com',
    BtnCancel: 'إلغاء',
    BtnSubmitFeedback: 'إرسال',
    FeedbackSubmitted: 'شكرًا! تم إرسال ملاحظاتك بنجاح',
    FeedbackError: 'فشل إرسال الملاحظات. حاول مرة أخرى.',
    TitleMinLength: 'يجب أن يكون العنوان 3 أحرف على الأقل',
    TitleMaxLength: 'يجب أن يكون العنوان أقل من 100 حرف',
    FeedbackMinLength: 'يجب أن تكون الملاحظات 5 أحرف على الأقل',
    FeedbackMaxLength: 'يجب أن تكون الملاحظات أقل من 1000 حرف',
    InvalidEmail: 'عنوان البريد الإلكتروني غير صالح',
  },
};

export function initIssieSharedLang(): void {
  const locales = getLocales();
  const lang = locales[0]?.languageCode ?? 'en';
  const tag = locales[0]?.languageTag ?? 'en';
  const isRTL = lang === 'he' || lang === 'ar';
  initLang(feedbackStrings, { languageTag: tag, isRTL });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/issie-shared-lang.ts
git commit -m "feat: bridge issie-shared lang for FeedbackDialog translations"
```

---

## Task 7: Wire initialization in app entry

**Files:**
- Modify: `index.js`

- [ ] **Step 1: Add init calls to index.js**

In `index.js`, add these two imports and calls before `AppRegistry.registerComponent`. The file currently looks like:

```javascript
import React from 'react';
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { GlobalContext } from './src/contexts/GlobalContext';
```

Add after the existing imports:
```javascript
import { initIssieSharedLang } from './src/issie-shared-lang';
import { initializeFirebase } from './src/firebase-config';

initIssieSharedLang();
initializeFirebase();
```

So the full file becomes:
```javascript
/**
 * @format
 */

import React from 'react';
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { GlobalContext } from './src/contexts/GlobalContext';
import { initIssieSharedLang } from './src/issie-shared-lang';
import { initializeFirebase } from './src/firebase-config';

initIssieSharedLang();
initializeFirebase();

function AppContainer(props) {
  const now = new Date();
  return (
    <GlobalContext.Provider
      value={{
        nativeStartTime: props.nativeStartTime ?? now.getTime(),
      }}>
      <App />
    </GlobalContext.Provider>
  );
}

AppRegistry.registerComponent(appName, () => AppContainer);
```

- [ ] **Step 2: Commit**

```bash
git add index.js
git commit -m "feat: call initIssieSharedLang and initializeFirebase at app startup"
```

---

## Task 8: Add feedback translation key

**Files:**
- Modify: `src/i18n/translations.ts`

The `Translations` interface and all language objects need a `feedback` key added to the `settings` section.

- [ ] **Step 1: Add to Translations interface**

Find the `settings:` block in the interface (around line 129):
```typescript
settings: {
  title: string;
  selectTheme: string;
  selectLanguage: string;
  restartRequired: string;
  restartMessage: string;
  ok: string;
};
```

Add `feedback: string;`:
```typescript
settings: {
  title: string;
  selectTheme: string;
  selectLanguage: string;
  restartRequired: string;
  restartMessage: string;
  ok: string;
  feedback: string;
};
```

- [ ] **Step 2: Add the Hebrew value**

Find the Hebrew `settings:` block (around line 370):
```typescript
settings: {
  title: 'הגדרות',
  selectTheme: 'בחר ערכת נושא',
  selectLanguage: 'בחר שפה',
  restartRequired: 'נדרש אתחול',
  restartMessage: 'יש להפעיל מחדש את האפליקציה כדי שהשינוי ייכנס לתוקף.',
  ok: 'אישור',
},
```

Add `feedback`:
```typescript
settings: {
  title: 'הגדרות',
  selectTheme: 'בחר ערכת נושא',
  selectLanguage: 'בחר שפה',
  restartRequired: 'נדרש אתחול',
  restartMessage: 'יש להפעיל מחדש את האפליקציה כדי שהשינוי ייכנס לתוקף.',
  ok: 'אישור',
  feedback: 'שלח משוב',
},
```

- [ ] **Step 3: Add to all other language objects**

Find and update the English `settings:` block (search for `selectTheme: 'Select Theme'` or similar):
```typescript
settings: {
  // ... existing keys ...
  feedback: 'Send Feedback',
},
```

Find and update the Arabic `settings:` block (search for `selectTheme:` in the Arabic section):
```typescript
settings: {
  // ... existing keys ...
  feedback: 'إرسال ملاحظات',
},
```

There may be additional language objects (e.g. a 4th language). Add `feedback` to every `settings:` block that exists.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "feedback\|settings" | head -10
```

Expected: no errors mentioning `feedback`.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat: add settings.feedback translation key (EN/HE/AR)"
```

---

## Task 9: Wire FeedbackDialog into SettingsScreen

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Add FeedbackDialog import**

At the top of `SettingsScreen.tsx`, add to the imports:
```typescript
import { FeedbackDialog } from '@beitissieshapiro/issie-shared';
```

- [ ] **Step 2: Add showFeedback state**

Inside the `SettingsScreen` function, after the existing `useState` calls:
```typescript
const [showFeedback, setShowFeedback] = useState(false);
```

- [ ] **Step 3: Add feedback button in ScrollView**

In the `ScrollView`'s `contentContainerStyle`, after the backup button `TouchableOpacity` block (after the closing `</TouchableOpacity>` of the backup button), add:

```tsx
{/* Feedback Section */}
<Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: spacing.xxl }]}>
  {t('settings.feedback')}
</Text>

<TouchableOpacity
  style={[
    styles.backupButton,
    {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.medium,
      padding: spacing.lg,
    },
  ]}
  onPress={() => setShowFeedback(true)}
  activeOpacity={0.7}
>
  <Icon name="chatbubble-outline" size={24} color="#FFF" />
  <Text style={styles.backupButtonText}>
    {t('settings.feedback')}
  </Text>
</TouchableOpacity>
```

- [ ] **Step 4: Render FeedbackDialog**

Just before the closing `</View>` of the main container (at the end of the `return` statement), add:
```tsx
<FeedbackDialog
  appName="IssieAlbum"
  visible={showFeedback}
  onClose={() => setShowFeedback(false)}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "settings\|feedback\|FeedbackDialog" | head -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: add Send Feedback button and FeedbackDialog to SettingsScreen"
```

---

## Task 10: Manual smoke test

No automated tests exist for this flow (Firebase integration requires a live device/emulator). Verify manually:

- [ ] **Step 1: Run on iOS simulator**

```bash
yarn ios
```

Expected: app launches without crash. No Firebase errors in console.

- [ ] **Step 2: Open Settings and tap Send Feedback**

Navigate: open the settings modal → scroll down → tap "Send Feedback" (or "שלח משוב" / "إرسال ملاحظات" depending on device language).

Expected: `FeedbackDialog` modal opens with Title, Feedback, and Email fields.

- [ ] **Step 3: Submit feedback**

Enter a title (≥3 chars) and feedback text (≥5 chars). Tap Submit.

Expected: success alert "Thank you! Your feedback was submitted successfully" (or localised equivalent). No errors.

- [ ] **Step 4: Verify in Firebase console**

Go to Firebase Console → Firestore → `userFeedback` collection.

Expected: a new document with `appName: "IssieAlbum"`, the title and feedback text you entered.

- [ ] **Step 5: Run on Android emulator**

```bash
yarn android
```

Expected: same behaviour as iOS.
