#!/bin/bash
# Robust iOS Simulator Runner for Casa Owner App
# Usage: ./scripts/run-ios-simulator.sh [--rebuild]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BUNDLE_ID="com.casa.owner"
SIMULATOR_NAME="iPhone 17 Pro"
METRO_PORT=8081

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[iOS Runner]${NC} $1"; }
warn() { echo -e "${YELLOW}[iOS Runner]${NC} $1"; }
error() { echo -e "${RED}[iOS Runner]${NC} $1"; exit 1; }

# Parse arguments
REBUILD=false
for arg in "$@"; do
    case $arg in
        --rebuild) REBUILD=true ;;
    esac
done

cd "$APP_DIR"

# Step 1: Kill any existing Metro process on port 8081
log "Clearing port $METRO_PORT..."
lsof -ti:$METRO_PORT | xargs kill -9 2>/dev/null || true

# Step 2: Boot the simulator
log "Booting $SIMULATOR_NAME simulator..."
SIMULATOR_UDID=$(xcrun simctl list devices available | grep "$SIMULATOR_NAME" | grep -oE '[A-F0-9-]{36}' | head -1)

if [ -z "$SIMULATOR_UDID" ]; then
    warn "Could not find simulator: $SIMULATOR_NAME, trying any available iPhone..."
    SIMULATOR_UDID=$(xcrun simctl list devices available | grep "iPhone" | grep -oE '[A-F0-9-]{36}' | head -1)
    if [ -z "$SIMULATOR_UDID" ]; then
        error "No iPhone simulator found"
    fi
fi

xcrun simctl boot "$SIMULATOR_UDID" 2>/dev/null || true
open -a Simulator

# Wait for simulator to boot
log "Waiting for simulator to boot..."
while true; do
    STATE=$(xcrun simctl list devices | grep "$SIMULATOR_UDID" | grep -o "(Booted)" || true)
    if [ "$STATE" = "(Booted)" ]; then
        break
    fi
    sleep 1
done
log "Simulator booted: $SIMULATOR_UDID"

# Step 3: Rebuild if requested or if no build exists
if [ "$REBUILD" = true ]; then
    log "Rebuilding iOS app..."
    cd "$APP_DIR/ios"

    # Clear extended attributes that can cause codesign issues
    xattr -rc . 2>/dev/null || true

    xcodebuild -workspace CasaOwner.xcworkspace \
        -scheme CasaOwner \
        -configuration Debug \
        -destination "id=$SIMULATOR_UDID" \
        -derivedDataPath build \
        build 2>&1 | grep -E "(error:|warning:|BUILD|Compiling|Linking)" || true

    # Install the app
    APP_PATH=$(find build -name "CasaOwner.app" -type d | head -1)
    if [ -n "$APP_PATH" ]; then
        log "Installing app to simulator..."
        xattr -rc "$APP_PATH" 2>/dev/null || true
        xcrun simctl install "$SIMULATOR_UDID" "$APP_PATH"
    fi
    cd "$APP_DIR"
fi

# Step 4: Start Metro bundler in background
log "Starting Metro bundler on port $METRO_PORT..."
npx expo start --dev-client --localhost --port $METRO_PORT &
METRO_PID=$!

# Wait for Metro to be ready
log "Waiting for Metro bundler to start..."
for i in {1..30}; do
    if curl -s "http://127.0.0.1:$METRO_PORT/status" 2>/dev/null | grep -q "packager-status:running"; then
        log "Metro bundler is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Metro bundler failed to start after 30 seconds"
    fi
    sleep 1
done

# Step 5: Launch the app on simulator
log "Launching app on simulator..."
sleep 2  # Give Metro a moment to stabilize
xcrun simctl launch "$SIMULATOR_UDID" "$BUNDLE_ID"

log "App launched successfully!"
log "Metro bundler running on http://localhost:$METRO_PORT"
log "Press Ctrl+C to stop Metro and exit"

# Keep Metro running in foreground
wait $METRO_PID
