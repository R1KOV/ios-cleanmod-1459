#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$ROOT_DIR/ios/App"
OUT_DIR="$ROOT_DIR/dist-ios"
DERIVED_DATA="$OUT_DIR/DerivedData"
APP_NAME="FlacLess"

echo "==> [1/5] Installing npm dependencies (if needed)..."
cd "$ROOT_DIR"
if [ ! -d "node_modules" ]; then
  npm ci
fi

echo "==> [2/5] Building production Vite web bundle..."
npm run build

echo "==> [3/5] Syncing Capacitor iOS web assets and plugins..."
npx cap sync ios

echo "==> [4/5] Building Release iOS app (arm64)..."
rm -rf "$DERIVED_DATA"
mkdir -p "$OUT_DIR"

XCODE_ARGS=(
  -project "$IOS_DIR/App.xcodeproj"
  -scheme App
  -configuration Release
  -sdk iphoneos
  -destination "generic/platform=iOS"
  -derivedDataPath "$DERIVED_DATA"
  ARCHS=arm64
  ONLY_ACTIVE_ARCH=NO
  IPHONEOS_DEPLOYMENT_TARGET=15.0
)

if [ -n "${DEVELOPMENT_TEAM:-}" ] && [ -n "${PROVISIONING_PROFILE_SPECIFIER:-}" ]; then
  echo "    Signing with team $DEVELOPMENT_TEAM..."
  xcodebuild "${XCODE_ARGS[@]}" \
    -archivePath "$OUT_DIR/$APP_NAME.xcarchive" \
    DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" \
    PROVISIONING_PROFILE_SPECIFIER="$PROVISIONING_PROFILE_SPECIFIER" \
    archive

  cat > "$OUT_DIR/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>${EXPORT_METHOD:-ad-hoc}</string>
  <key>teamID</key>
  <string>${DEVELOPMENT_TEAM}</string>
  <key>compileBitcode</key>
  <false/>
</dict>
</plist>
EOF

  xcodebuild -exportArchive \
    -archivePath "$OUT_DIR/$APP_NAME.xcarchive" \
    -exportPath "$OUT_DIR/signed" \
    -exportOptionsPlist "$OUT_DIR/ExportOptions.plist"
  echo "==> Signed IPA ready in $OUT_DIR/signed/"
  exit 0
fi

echo "    Building unsigned App.app (compatible with Sideloadly / AltStore / SideStore / ESign / Feather / TrollStore)..."
xcodebuild "${XCODE_ARGS[@]}" \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO \
  build

APP_PATH="$(find "$DERIVED_DATA/Build/Products/Release-iphoneos" -maxdepth 2 -name "*.app" | head -n 1)"
if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
  echo "ERROR: Built .app bundle not found in $DERIVED_DATA" >&2
  exit 1
fi

echo "==> [5/5] Packaging Payload/App.app -> $OUT_DIR/${APP_NAME}-iOS-unsigned.ipa..."
PAYLOAD_DIR="$OUT_DIR/Payload"
rm -rf "$PAYLOAD_DIR"
mkdir -p "$PAYLOAD_DIR"
cp -R "$APP_PATH" "$PAYLOAD_DIR/App.app"

# Strip any extended attributes or stray signature folders for clean sideloading
rm -rf "$PAYLOAD_DIR/App.app/_CodeSignature"
xattr -cr "$PAYLOAD_DIR/App.app" 2>/dev/null || true

cd "$OUT_DIR"
rm -f "${APP_NAME}-iOS-unsigned.ipa"
zip -qr "${APP_NAME}-iOS-unsigned.ipa" Payload
rm -rf "$PAYLOAD_DIR"

echo "==> Done! Ready to install:"
ls -lh "$OUT_DIR/${APP_NAME}-iOS-unsigned.ipa"
