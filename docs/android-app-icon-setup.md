# Android App Icon Setup

## Overview
The IssieAlbom app now uses Android's Adaptive Icon system (API 26+) with a vector drawable foreground.

## Files Created

### 1. Vector Foreground Drawable
**Location:** `android/app/src/main/res/drawable/ic_launcher_foreground.xml`

This is the main icon graphic converted from the SVG. It contains:
- The book/album symbol with heart (main icon element)
- The bird and person illustration
- All paths converted to Android vector drawable format
- Scaled and positioned to fit within the 108dp safe zone

### 2. Background Color Resource
**Location:** `android/app/src/main/res/values/ic_launcher_background.xml`

Defines the blue background color (#00BCF5) that was previously part of the SVG.

### 3. Adaptive Icon XMLs
**Location:**
- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml`

These define the adaptive icon structure:
- Background layer: solid blue color
- Foreground layer: vector drawable with icon graphics

## How It Works

### Adaptive Icons
Android 8.0+ (API 26+) uses adaptive icons which provide:
- **Automatic masking** - Different device manufacturers can apply different shapes (circle, squircle, rounded square)
- **Visual effects** - Icons can have parallax effects and animations
- **Consistency** - All icons follow the same visual guidelines

### Safe Zones
The 108dp canvas has specific zones:
- **Full canvas:** 108dp × 108dp
- **Visible area:** 72dp × 72dp (center, always visible)
- **Masked area:** Different shapes depending on OEM

The icon elements are positioned to be fully visible within the safe zone.

## Backwards Compatibility

For devices running Android 7.1 and earlier (API < 26):
- The existing PNG icons in `mipmap-*dpi/` folders are still used
- These provide fallback support for older devices
- You may want to regenerate these PNGs from the new vector design for consistency

## Testing

To verify the icon appears correctly:
1. Build and install the app: `./gradlew assembleDebug && adb install -r app/build/outputs/apk/debug/app-debug.apk`
2. Check the launcher screen - icon should have blue background with the album/bird design
3. Test on different Android versions (7.x vs 8.0+) to verify both icon types work
4. Long-press the icon to see the adaptive icon's parallax effect (Android 8.0+)

## Customization

To change the icon:
1. **Edit the foreground:** Modify `drawable/ic_launcher_foreground.xml`
   - Adjust paths, colors, or positioning
   - Keep elements within the 72dp safe zone for best results
2. **Change background:** Update the color in `values/ic_launcher_background.xml`
   - Can be a solid color or a reference to a drawable
3. **Rebuild:** Run `./gradlew clean assembleDebug` after changes

## Resources

- [Android Adaptive Icons Guide](https://developer.android.com/guide/practices/ui_guidelines/icon_design_adaptive)
- [Vector Drawable Reference](https://developer.android.com/reference/android/graphics/drawable/VectorDrawable)
