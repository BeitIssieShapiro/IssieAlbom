# Android Deployment for IssieAlbum

## Setup Complete ✅

IssieAlbum is now configured to use the shared deployment system from `issie-shared`.

## Deploy to Google Play

To deploy IssieAlbum to Google Play Internal Track:

```bash
npm run deploy:android
```

This will:
1. ✅ Verify git status is clean
2. 📈 Increment version code in `android/version.properties`
3. 🔨 Build release AAB bundle (signed with shared keystore)
4. ☁️ Upload to Google Play Internal Track as **DRAFT**
5. 💾 Commit version bump to git

## After Deploy

1. Go to [Google Play Console](https://play.google.com/console)
2. Find IssieAlbum
3. Navigate to Internal Testing track
4. Review the draft release
5. Publish when ready

## Configuration

### Version Management
Versions are managed in `android/version.properties`:
```properties
issiealbum.versionCode=1
issiealbum.versionName=1.0
```

### Signing
- Uses shared keystore: `issie-shared/android/keys/uploadkeystore.jks`
- Configured in: `issie-shared/android/keys/signing-config.properties`
- Project listed in: `issie.main.projects`

### Build Configuration
- `android/app/build.gradle` loads versions dynamically
- Release builds use `signingConfigs.release` (not debug!)
- Signing applied via `apply-signing.gradle`

## Manual Build (Testing)

To build AAB without deploying:

```bash
cd android
./gradlew clean
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

## Troubleshooting

### "Version code already used"
The version is auto-incremented on each deploy. If it fails mid-deploy, manually increment in `android/version.properties`.

### "Keystore not found"
Ensure `issie-shared/android/keys/uploadkeystore.jks` exists. Check with:
```bash
ls -la ../../issie-shared/android/keys/uploadkeystore.jks
```

### "AAB signed with wrong key"
Ensure `signingConfig signingConfigs.release` is set in release buildType (not debug).

## Related Documentation

- `issie-shared/README.md` - Shared deployment overview
- `issie-shared/QUICK_START.md` - Setup checklist
- `issie-shared/DEPLOYMENT_SETUP_SUMMARY.md` - Detailed guide
- `issie-shared/ADDING_NEW_PROJECT.md` - How projects are configured
- `issie-shared/CENTRALIZED_SIGNING.md` - Signing system details
