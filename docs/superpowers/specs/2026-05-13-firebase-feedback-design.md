# Firebase + User Feedback — IssieAlbom

## Goal

Add Firebase (App Check + Analytics + Cloud Functions) and wire the `FeedbackDialog` from `@beitissieshapiro/issie-shared` into the Settings screen.

---

## 1. Dependencies

Add to `package.json`:

**dependencies:**
- `@react-native-firebase/app: ^23.8.6`
- `@react-native-firebase/app-check: ^23.8.6`
- `@react-native-firebase/functions: ^23.8.6`
- `@react-native-firebase/analytics: ^23.8.6`
- `@beitissieshapiro/issie-shared: ^1.0.3`

---

## 2. Native iOS

### Podfile (`ios/Podfile`)
Add before the `target` block:
```ruby
use_frameworks! :linkage => :static
$RNFirebaseAsStaticFramework = true
$RNFirebaseAnalyticsWithoutAdIdSupport = true
```

### AppDelegate.swift (`ios/IssieAlbum/AppDelegate.swift`)
Add imports:
```swift
import RNFBAppCheck
import FirebaseCore
import Firebase
```

At the top of `didFinishLaunchingWithOptions`, before any other code:
```swift
RNFBAppCheckModule.sharedInstance()
FirebaseApp.configure()
```

`GoogleService-Info.plist` is already registered in the Xcode project.

---

## 3. Native Android

### `android/build.gradle`
Add to `dependencies` block in `buildscript`:
```groovy
classpath("com.google.gms:google-services:4.4.2")
```

### `android/app/build.gradle`
Add plugin at top:
```groovy
apply plugin: "com.google.gms.google-services"
```

Add to `dependencies` block:
```groovy
implementation platform("com.google.firebase:firebase-bom:34.9.0")
implementation "com.google.firebase:firebase-analytics"
```

`google-services.json` is at `android/app/google-services.json` (moved from `src/main/` — wrong location).

---

## 4. JS Layer

### `src/common/debug-token.ts` (new file)
```typescript
export const debugToken = "<UUID>";
```
UUID is a placeholder — developer generates one and registers it in Firebase console under App Check debug tokens.

### `src/firebase-config.ts` (new file)
```typescript
import { firebaseInit } from '@beitissieshapiro/issie-shared';
import { debugToken } from './common/debug-token';

export function initializeFirebase() {
  firebaseInit(debugToken);
}
```

### App entry point (`index.js` or `App.tsx`)
Call `initializeFirebase()` once on mount:
```typescript
import { initializeFirebase } from './src/firebase-config';

useEffect(() => {
  initializeFirebase();
}, []);
```

---

## 5. Language Bridge

`FeedbackDialog` uses `translate("Key")` from `@beitissieshapiro/issie-shared`'s internal `lang` module. IssieAlbom uses its own typed `t()` hook.

We must call `initLang` from issie-shared with the feedback strings so `translate()` resolves them. This call goes alongside `initializeFirebase()` in the app entry, using the existing language detection logic.

### New file: `src/issie-shared-lang.ts`
```typescript
import { initLang } from '@beitissieshapiro/issie-shared';
import { getLocales } from 'react-native-localize';

const feedbackStrings = {
  he: {
    UserFeedback: "משוב משתמש",
    Feedback: "משוב",
    FeedbackTitleLabel: "כותרת / נושא",
    FeedbackTitlePlaceholder: "כותרת קצרה או נושא",
    FeedbackPlaceholder: "שתפו אותנו במה שעל ליבכם...",
    EmailTitle: "אימייל (אופציונלי)",
    EmailPlaceholder: "your@email.com",
    BtnCancel: "ביטול",
    BtnSubmitFeedback: "שליחה",
    FeedbackSubmitted: "תודה! המשוב נשלח בהצלחה",
    FeedbackError: "שליחת המשוב נכשלה. נסו שוב.",
    TitleMinLength: "הכותרת חייבת להכיל לפחות 3 תווים",
    TitleMaxLength: "הכותרת חייבת להכיל פחות מ-100 תווים",
    FeedbackMinLength: "המשוב חייב להכיל לפחות 5 תווים",
    FeedbackMaxLength: "המשוב חייב להכיל פחות מ-1000 תווים",
    InvalidEmail: "כתובת אימייל לא תקינה",
  },
  en: {
    UserFeedback: "User Feedback",
    Feedback: "Feedback",
    FeedbackTitleLabel: "Title / Subject",
    FeedbackTitlePlaceholder: "Enter a brief title or subject",
    FeedbackPlaceholder: "Share your thoughts with us...",
    EmailTitle: "Email (optional)",
    EmailPlaceholder: "your@email.com",
    BtnCancel: "Cancel",
    BtnSubmitFeedback: "Submit",
    FeedbackSubmitted: "Thank you! Your feedback was submitted successfully",
    FeedbackError: "Failed to submit feedback. Please try again.",
    TitleMinLength: "Title must be at least 3 characters",
    TitleMaxLength: "Title must be less than 100 characters",
    FeedbackMinLength: "Feedback must be at least 5 characters",
    FeedbackMaxLength: "Feedback must be less than 1000 characters",
    InvalidEmail: "Invalid email address",
  },
  ar: {
    UserFeedback: "ملاحظات المستخدم",
    Feedback: "ملاحظات",
    FeedbackTitleLabel: "العنوان / الموضوع",
    FeedbackTitlePlaceholder: "أدخل عنوانًا موجزًا أو موضوعًا",
    FeedbackPlaceholder: "شارك أفكارك معنا...",
    EmailTitle: "البريد الإلكتروني (اختياري)",
    EmailPlaceholder: "your@email.com",
    BtnCancel: "إلغاء",
    BtnSubmitFeedback: "إرسال",
    FeedbackSubmitted: "شكرًا! تم إرسال ملاحظاتك بنجاح",
    FeedbackError: "فشل إرسال الملاحظات. حاول مرة أخرى.",
    TitleMinLength: "يجب أن يكون العنوان 3 أحرف على الأقل",
    TitleMaxLength: "يجب أن يكون العنوان أقل من 100 حرف",
    FeedbackMinLength: "يجب أن تكون الملاحظات 5 أحرف على الأقل",
    FeedbackMaxLength: "يجب أن تكون الملاحظات أقل من 1000 حرف",
    InvalidEmail: "عنوان البريد الإلكتروني غير صالح",
  },
};

export function initIssieSharedLang() {
  const locales = getLocales();
  const lang = locales[0]?.languageCode;
  const tag = locales[0]?.languageTag ?? 'en';
  const isRTL = lang === 'he' || lang === 'ar';
  const detectedLang = lang === 'he' ? 'he' : lang === 'ar' ? 'ar' : 'en';
  initLang(feedbackStrings, { languageTag: tag, isRTL });
}
```

---

## 6. SettingsScreen

Add to `SettingsScreen.tsx`:
- `import { FeedbackDialog } from '@beitissieshapiro/issie-shared';`
- State: `const [showFeedback, setShowFeedback] = useState(false);`
- Button in ScrollView (after backup section), styled identically to the backup button:
  ```tsx
  <TouchableOpacity style={[styles.backupButton, { backgroundColor: colors.primary, ... }]}
    onPress={() => setShowFeedback(true)}>
    <Icon name="chatbubble-outline" size={24} color="#FFF" />
    <Text style={styles.backupButtonText}>{t('settings.feedback')}</Text>
  </TouchableOpacity>
  ```
- Dialog:
  ```tsx
  <FeedbackDialog appName="IssieAlbum" visible={showFeedback} onClose={() => setShowFeedback(false)} />
  ```
- Add `settings.feedback` translation key to `translations.ts` (EN: "Send Feedback", HE: "שלח משוב", AR: "إرسال ملاحظات").

---

## 7. Initialization Order

In `index.js` (app entry, before `AppRegistry.registerComponent`):
```typescript
import { initIssieSharedLang } from './src/issie-shared-lang';
import { initializeFirebase } from './src/firebase-config';

initIssieSharedLang();
initializeFirebase();
```

Both calls are synchronous-safe at module level (Firebase async init happens inside `firebaseInit`).

---

## Files Changed / Created

| File | Action |
|------|--------|
| `package.json` | Add Firebase + issie-shared deps |
| `ios/Podfile` | Add static frameworks flags |
| `ios/IssieAlbum/AppDelegate.swift` | Add Firebase imports + configure |
| `android/build.gradle` | Add google-services classpath |
| `android/app/build.gradle` | Add plugin + Firebase BOM |
| `src/common/debug-token.ts` | New — App Check debug token |
| `src/firebase-config.ts` | New — Firebase init wrapper |
| `src/issie-shared-lang.ts` | New — feed feedback strings to issie-shared |
| `index.js` | Call initIssieSharedLang + initializeFirebase |
| `src/screens/SettingsScreen.tsx` | Add feedback button + FeedbackDialog |
| `src/i18n/translations.ts` | Add `settings.feedback` key |
