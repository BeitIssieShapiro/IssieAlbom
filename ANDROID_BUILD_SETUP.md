# Android Build & Debug Setup

## Prerequisites

### Java Runtime

**Recommended: OpenJDK 21**

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH="$JAVA_HOME/bin:$PATH"
java -version
```

### Android SDK

Located at: `/Users/i022021/Library/Android/sdk`

ADB: `/Users/i022021/Library/Android/sdk/platform-tools/adb`

## Build Commands

### Quick Build & Deploy

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH="$JAVA_HOME/bin:$PATH"
export JAVA_TOOL_OPTIONS="--enable-native-access=ALL-UNNAMED"
cd android && ./gradlew installDebug
```

> **Note:** `JAVA_TOOL_OPTIONS` is required to suppress a JNA "restricted method" warning from
> the prefab binary that AGP 8.12+ treats as a fatal error. Without it, the build fails at
> `:react-native-nitro-modules:configureCMakeDebug`.

### Using React Native CLI

```bash
yarn start &
yarn android
```

### Manual Emulator Management

```bash
~/Library/Android/sdk/emulator/emulator -list-avds
~/Library/Android/sdk/emulator/emulator @Pixel_3a &
~/Library/Android/sdk/platform-tools/adb devices
```

## Build Output

- **APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Build logs**: `android/build/reports/`

## Common Build Issues

### "Unable to locate a Java Runtime"

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH="$JAVA_HOME/bin:$PATH"
```

### ADB "Operation not permitted"

```bash
killall adb
~/Library/Android/sdk/platform-tools/adb start-server
```

### Emulator fails to start

Start emulator manually first:
```bash
~/Library/Android/sdk/emulator/emulator @Pixel_3a &
# Wait for boot, then: yarn android
```

## Build Configuration

- **Min SDK**: 24 (Android 7.0)
- **Target SDK**: 36 (Android 15)
- **Kotlin**: 2.1.20
- **Gradle**: 9.3.1
- **Build time**: ~1-2 minutes (incremental builds much faster)

## Debugging

### View Logs

```bash
# All logs
~/Library/Android/sdk/platform-tools/adb logcat

# Filter by app package
~/Library/Android/sdk/platform-tools/adb logcat | grep org.issieshapiro.issiealbum

# React Native JS logs only
~/Library/Android/sdk/platform-tools/adb logcat -s ReactNativeJS

# Firebase/App Check logs
~/Library/Android/sdk/platform-tools/adb logcat | grep -E "Firebase|AppCheck|RNFBApp"
```

### Debug Mode

- React Native dev menu: shake device or `adb shell input keyevent 82`
- Chrome DevTools: enable remote debugging from dev menu

### Release Build

```bash
cd android && ./gradlew assembleRelease
```

## Clean Build

```bash
cd android
./gradlew clean
./gradlew cleanBuildCache
rm -rf app/build build .gradle
```

## Troubleshooting Checklist

1. ✅ **Java configured?**
   ```bash
   echo $JAVA_HOME && java -version
   ```

2. ✅ **Emulator/device connected?**
   ```bash
   ~/Library/Android/sdk/platform-tools/adb devices
   ```

3. ✅ **Metro bundler running?**
   ```bash
   yarn start
   ```

4. ✅ **Try clean build?**
   ```bash
   cd android && ./gradlew clean && ./gradlew installDebug
   ```
