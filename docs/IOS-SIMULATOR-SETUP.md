# iOS Simulator Setup Guide for Stead Owner App

This document explains the iOS development setup, the issues we encountered, and how to maintain a working iOS build going forward.

## Quick Start

```bash
# From apps/owner directory
cd /Users/robbiespooner/Desktop/propbot/apps/owner

# Run iOS simulator (uses existing build)
./scripts/run-ios-simulator.sh

# Run with full rebuild (use after dependency changes)
./scripts/run-ios-simulator.sh --rebuild
```

## Architecture Overview

```
propbot/                          # Monorepo root
├── node_modules/                 # All dependencies hoisted here (pnpm)
│   ├── expo-linking/            # Native module
│   ├── expo-constants/          # Native module
│   └── ...
├── apps/
│   └── owner/
│       ├── ios/
│       │   ├── Podfile          # CocoaPods configuration
│       │   ├── Pods/            # Installed native dependencies
│       │   ├── SteadOwner.xcworkspace
│       │   └── build/           # Xcode build output
│       └── package.json
└── packages/                    # Shared workspace packages
```

## Issues We Encountered & Solutions

### 1. Native Module Linking (ExpoLinking, EXConstants)

**Problem**: With pnpm's hoisting, expo modules are installed in the monorepo root's `node_modules/`, not in `apps/owner/node_modules/`. Expo's autolinking couldn't find them.

**Symptoms**:
```
ERROR: Cannot find native module 'ExpoLinking'
ERROR: Cannot find native module 'ExponentConstants'
```

**Solution**: Manually specify the pod paths in `ios/Podfile`:
```ruby
target 'SteadOwner' do
  use_expo_modules!
  config = use_native_modules!

  # Manually add modules that autolinking misses in pnpm monorepo
  pod 'ExpoLinking', :path => '../../../node_modules/expo-linking/ios'
  pod 'EXConstants', :path => '../../../node_modules/expo-constants/ios'

  # ... rest of config
end
```

**Status**: ✅ FIXED - These manual pod entries are now in the Podfile.

### 2. iOS Deployment Target Mismatch

**Problem**: expo-linking requires iOS 15.1+, but Expo SDK 51 defaults to iOS 13.4.

**Symptoms**:
```
error: module 'ExpoLinking' has a minimum deployment target of iOS 15.1
```

**Solution**: Updated `ios/Podfile` to use iOS 15.1:
```ruby
platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'
```

Also updated `ios/SteadOwner.xcodeproj/project.pbxproj`:
```
IPHONEOS_DEPLOYMENT_TARGET = 15.1
```

**Status**: ✅ FIXED - Both Podfile and Xcode project updated.

### 3. Workspace/Scheme Name Mismatch

**Problem**: After `expo prebuild`, the workspace changed from `owner.xcworkspace` to `SteadOwner.xcworkspace`.

**Solution**: Updated `scripts/run-ios-simulator.sh` to use correct names:
```bash
xcodebuild -workspace SteadOwner.xcworkspace \
    -scheme SteadOwner \
    ...
```

**Status**: ✅ FIXED - Script updated.

### 4. Podfile Privacy Manifest Option

**Problem**: The `:privacy_file_aggregation_enabled` option isn't supported in React Native 0.74.

**Solution**: Removed the unsupported option from `use_react_native!()` call.

**Status**: ✅ FIXED - Option removed from Podfile.

### 5. Codesign "Resource Fork" Error

**Problem**: macOS extended attributes cause codesign to fail.

**Symptoms**:
```
resource fork, Finder information, or similar detritus not allowed
```

**Solution**: Clear extended attributes before signing:
```bash
xattr -rc /path/to/SteadOwner.app
codesign --force --sign - /path/to/SteadOwner.app
```

**Status**: ⚠️ WORKAROUND - May need to run manually after builds if it recurs.

### 6. npm Cache Permission Issues

**Problem**: Root-owned files in `~/.npm` cache caused prebuild failures.

**Symptoms**:
```
npm error code EACCES
npm error Your cache folder contains root-owned files
```

**Solution**: Fix ownership:
```bash
sudo chown -R $(whoami):staff ~/.npm
```

**Status**: ⚠️ REQUIRES MANUAL FIX - Run this command if you see npm cache errors.

## Current Configuration Files

### ios/Podfile (Key Sections)

```ruby
platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'

target 'SteadOwner' do
  use_expo_modules!
  config = use_native_modules!

  # Manually add ExpoLinking since autolinking doesn't find it in pnpm monorepo
  pod 'ExpoLinking', :path => '../../../node_modules/expo-linking/ios'
  pod 'EXConstants', :path => '../../../node_modules/expo-constants/ios'

  use_react_native!(
    :path => config[:reactNativePath],
    :hermes_enabled => podfile_properties['expo.jsEngine'] == nil || podfile_properties['expo.jsEngine'] == 'hermes',
    :app_path => "#{Pod::Config.instance.installation_root}/..",
  )
  # ... post_install hooks
end
```

### scripts/run-ios-simulator.sh

The script handles:
1. Killing existing Metro processes
2. Booting iPhone 17 Pro simulator
3. Applying expo-dev-menu patches for Xcode 16+
4. Running pod install and xcodebuild (with --rebuild flag)
5. Installing app to simulator
6. Starting Metro bundler
7. Launching the app

## Maintenance Procedures

### After Adding New Expo/Native Modules

1. **Check if autolinking finds it**:
   ```bash
   cd apps/owner
   npx expo-modules-autolinking resolve --platform ios | grep "module-name"
   ```

2. **If not found, add to Podfile manually**:
   ```ruby
   pod 'ModuleName', :path => '../../../node_modules/module-name/ios'
   ```

3. **Rebuild**:
   ```bash
   cd apps/owner/ios
   rm -rf Pods Podfile.lock build
   pod install
   cd ..
   ./scripts/run-ios-simulator.sh --rebuild
   ```

### After Upgrading Expo SDK

1. **Regenerate iOS project**:
   ```bash
   cd apps/owner
   rm -rf ios
   npx expo prebuild --platform ios
   ```

2. **Re-apply manual fixes to Podfile**:
   - Add manual pod entries for ExpoLinking and EXConstants
   - Verify deployment target is 15.1+
   - Remove any unsupported options

3. **Update run-ios-simulator.sh** if workspace/scheme names change

4. **Full rebuild**:
   ```bash
   ./scripts/run-ios-simulator.sh --rebuild
   ```

### Troubleshooting Common Issues

#### "Cannot find native module X"
→ Module not linked. Add to Podfile manually and rebuild.

#### "Minimum deployment target" error
→ Check ios version in Podfile and Xcode project settings.

#### Metro bundler not connecting
→ Kill existing processes: `lsof -ti:8081 | xargs kill -9`

#### Build succeeds but app shows old code
→ Uninstall app from simulator and reinstall:
```bash
xcrun simctl uninstall booted com.stead.owner
xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/SteadOwner.app
```

#### Codesign fails with "resource fork" error
→ Clear extended attributes:
```bash
xattr -rc ios/build/Build/Products/Debug-iphonesimulator/SteadOwner.app
```

## What's Fully Working vs Workarounds

### Fully Working (Proper Fixes)
- ✅ ExpoLinking native module (manual Podfile entry)
- ✅ EXConstants native module (manual Podfile entry)
- ✅ iOS 15.1 deployment target
- ✅ Correct workspace/scheme names in build script
- ✅ Hermes JS engine
- ✅ Metro bundler connection
- ✅ Hot reload

### Workarounds That May Need Attention
- ⚠️ **Manual pod entries**: If Expo improves pnpm autolinking in future SDK versions, these manual entries could become redundant (harmless, but unnecessary)
- ⚠️ **Codesign xattr issue**: May recur on fresh builds; run `xattr -rc` if needed
- ⚠️ **npm cache permissions**: One-time fix needed if you see EACCES errors

### Not Yet Addressed
- 📝 Privacy manifest (Apple requirement for App Store) - template generated but not configured
- 📝 Release builds - only Debug configuration tested
- 📝 Physical device testing - only simulator tested

## Environment Requirements

- **macOS**: Ventura or later
- **Xcode**: 16.0+ (we have 17.2)
- **iOS Simulator**: iPhone 17 Pro (or update SIMULATOR_NAME in script)
- **Node.js**: 18+
- **pnpm**: 9.0.0
- **CocoaPods**: Latest (auto-installed by Expo)

## File Locations

| File | Purpose |
|------|---------|
| `apps/owner/ios/Podfile` | CocoaPods config with manual module entries |
| `apps/owner/ios/SteadOwner.xcodeproj/project.pbxproj` | Xcode project settings |
| `apps/owner/scripts/run-ios-simulator.sh` | Automated build & run script |
| `apps/owner/app.json` | Expo configuration |

## Contact

If iOS builds break again, check:
1. This document for known issues
2. Expo SDK changelog for breaking changes
3. React Native changelog for iOS-specific changes
