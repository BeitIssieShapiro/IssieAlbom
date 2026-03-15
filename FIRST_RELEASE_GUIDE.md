# IssieAlbum - First Release Upload Guide

## Release Details

- **App ID**: `org.issieshapiro.issiealbum`
- **Version Code**: 2
- **Version Name**: 1.0
- **Release Type**: Internal Testing (recommended for first release)

## Release Bundle Location

After building, the release AAB will be at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

## Manual Upload Steps

### 1. Create the App in Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Click **"Create app"**
3. Fill in details:
   - **App name**: IssieAlbum (or your preferred name)
   - **Default language**: English (United States)
   - **App or game**: App
   - **Free or paid**: Free
4. Complete the declarations and click **"Create app"**

### 2. Complete Store Listing (Required before first release)

Navigate to **Store presence** → **Main store listing**:

**Required fields:**
- App name: `IssieAlbum`
- Short description: (50 characters) e.g., "Create interactive photo albums with drawings and audio"
- Full description: (up to 4000 characters)
- App icon: 512x512 PNG (you can use the icon from `assets/icon/issiealbum-icon.svg`)
- Feature graphic: 1024x500 PNG
- Screenshots: At least 2 phone screenshots (you'll need to capture these from the app)

### 3. Set Up Internal Testing Track

1. In Google Play Console, go to **Testing** → **Internal testing**
2. Click **"Create new release"**
3. Upload the AAB:
   - Click **"Upload"**
   - Select `android/app/build/outputs/bundle/release/app-release.aab`
4. Review the upload
5. Add release notes (what's new in this version)
6. Click **"Save"** (as draft)

### 4. Add Testers

1. In Internal testing, go to **"Testers"** tab
2. Create an email list with test user emails
3. Click **"Save changes"**

### 5. Review and Publish

1. Make sure all required sections are complete:
   - Store listing ✅
   - App content (privacy policy, age rating, etc.) ✅
   - Release uploaded ✅
2. Click **"Review release"**
3. Click **"Start rollout to Internal testing"**

### 6. Install on Test Devices

1. Copy the opt-in URL from the Internal testing page
2. Send to testers
3. They can install from Google Play

## Future Deploys

After the first manual upload, you can use automated deployment:

```bash
npm run deploy:android
```

This will:
- Auto-increment version code
- Build signed AAB
- Upload to Internal testing as DRAFT
- Commit version bump

## Signing Information

The release is signed with:
- **Keystore**: `issie-shared/android/keys/uploadkeystore.jks`
- **Alias**: key0
- **SHA-256**: 36:63:A5:92:28:18:05:24:C3:B4:D8:BE:3F:08:36:C7:47:99:42:14:A4:EF:57:CA:D6:AB:2F:89:8B:87:F8:C4

Google Play will use this to verify all future uploads.

## Troubleshooting

### "Upload key mismatch"
Make sure you're using the same keystore for all uploads. The keystore is in `issie-shared/android/keys/uploadkeystore.jks`.

### "Version code already exists"
Increment the version code in `android/version.properties` before building again.

### "Store listing incomplete"
Complete all required fields in the Store listing section before you can publish.

## Next Steps After First Release

1. Test the app thoroughly with internal testers
2. When ready, promote to **Closed testing** or **Open testing**
3. Eventually promote to **Production**
4. Use automated deployment for future updates: `npm run deploy:android`
