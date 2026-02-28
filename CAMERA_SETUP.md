# Camera Feature Installation

## Required Packages

To use the camera feature, you need to install these packages:

```bash
npm install react-native-camera-kit react-native-permissions
```

Or with yarn:

```bash
yarn add react-native-camera-kit react-native-permissions
```

## iOS Configuration

Add camera permissions to `ios/IssieAlbom/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>We need access to your camera to take photos for your album</string>
```

Then run:

```bash
cd ios && pod install && cd ..
```

## Android Configuration

Add camera permission to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

## Features

- ✅ Front/back camera switching
- ✅ Camera permission handling
- ✅ Loading indicators
- ✅ Image capture with 45% canvas width sizing
- ✅ Hebrew UI
- ✅ Cancel button
- ✅ Full-screen camera overlay

## Usage

1. Click the image tool in the editor
2. Click "מצלמה" (Camera) button
3. Grant camera permission if prompted
4. Use the camera reverse icon (top right) to switch between front/back camera
5. Tap the white circle button to capture
6. Image will be automatically added to the page at 45% width
