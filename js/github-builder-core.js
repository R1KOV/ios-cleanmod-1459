// js/github-builder-core.js
// Pure helpers, Git Blob SHA-1 hashing, bundle decoding & workflow YAML for GitHub Actions .ipa Cloud Builder

export const WORKFLOW_PATH = '.github/workflows/build-ios-ipa.yml';
export const SOURCE_BUNDLE_URL = './flacless-source-bundle.bin';

export const BUILD_WORKFLOW_YAML = `name: Build FlacLess iOS (.ipa)

on:
  workflow_dispatch:
    inputs:
      app_version:
        description: "Bundle display version (e.g. 2.5.1)"
        required: false
        default: "2.5.1"
      create_release:
        description: "Also publish .ipa to GitHub Releases?"
        required: false
        default: "false"
        type: choice
        options:
          - "false"
          - "true"
  push:
    branches:
      - main
      - master
    tags:
      - "v*"

permissions:
  contents: write

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"
  CI: "true"
  CAPACITOR_TELEMETRY: "false"
  FLACLESS_SKIP_SOURCE_BUNDLE: "1"

jobs:
  build-ios-ipa:
    name: Build Unsigned iOS IPA (arm64)
    runs-on: macos-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Verify FlacLess project workspace
        run: |
          MISSING=""
          for req in package.json vite.config.ts capacitor.config.ts ios/App/App.xcodeproj/project.pbxproj; do
            if [ ! -f "$req" ]; then
              MISSING="$MISSING $req"
            fi
          done
          if [ -n "$MISSING" ]; then
            echo "::error::В репозитории отсутствуют файлы FlacLess:$MISSING. Запустите сборку через окно «Собрать .ipa» в FlacLess с включённой автосинхронизацией исходников."
            exit 1
          fi
          echo "Workspace OK: FlacLess source tree verified."

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Select latest Xcode
        run: |
          XCODE_APP=$(ls -d /Applications/Xcode*.app 2>/dev/null | sort -V | tail -n 1 || true)
          if [ -n "$XCODE_APP" ]; then
            sudo xcode-select -s "$XCODE_APP/Contents/Developer"
          fi
          xcodebuild -version

      - name: Install dependencies
        run: |
          if [ -f package-lock.json ]; then
            npm ci --no-audit --no-fund || npm install --no-audit --no-fund
          else
            npm install --no-audit --no-fund --prefer-offline
          fi

      - name: Build Vite web bundle
        run: npm run build

      - name: Sync Capacitor iOS project
        run: |
          npx cap sync ios < /dev/null
          if [ ! -f ios/App/App/public/index.html ]; then
            echo "::error::Capacitor sync did not copy dist/index.html into ios/App/App/public"
            exit 1
          fi

      - name: Resolve Swift Package Manager dependencies
        run: |
          for attempt in 1 2; do
            echo "SPM resolve attempt $attempt..."
            if xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App; then
              exit 0
            fi
            sleep 5
          done
          echo "::error::Failed to resolve Swift Package Manager dependencies"
          exit 1

      - name: Build Release App.app (Unsigned arm64)
        env:
          APP_VER: \${{ github.event.inputs.app_version || '2.5.1' }}
        run: |
          mkdir -p dist-ios
          xcodebuild \\
            -project ios/App/App.xcodeproj \\
            -scheme App \\
            -configuration Release \\
            -sdk iphoneos \\
            -destination "generic/platform=iOS" \\
            -derivedDataPath dist-ios/DerivedData \\
            ARCHS=arm64 \\
            ONLY_ACTIVE_ARCH=NO \\
            IPHONEOS_DEPLOYMENT_TARGET=15.0 \\
            MARKETING_VERSION="$APP_VER" \\
            CURRENT_PROJECT_VERSION="\${{ github.run_number }}" \\
            CODE_SIGN_IDENTITY="" \\
            CODE_SIGNING_REQUIRED=NO \\
            CODE_SIGNING_ALLOWED=NO \\
            build

      - name: Package & verify FlacLess-iOS-unsigned.ipa
        run: |
          APP_PATH=$(find dist-ios/DerivedData/Build/Products/Release-iphoneos -maxdepth 2 -name "*.app" | head -n 1)
          if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
            echo "::error::App.app not found after xcodebuild!"
            exit 1
          fi
          rm -rf dist-ios/Payload
          mkdir -p dist-ios/Payload
          cp -R "$APP_PATH" dist-ios/Payload/App.app
          rm -rf dist-ios/Payload/App.app/_CodeSignature
          xattr -cr dist-ios/Payload/App.app 2>/dev/null || true
          if [ ! -f dist-ios/Payload/App.app/Info.plist ] || [ ! -f dist-ios/Payload/App.app/public/index.html ]; then
            echo "::error::Incomplete .app bundle (missing Info.plist or public/index.html)"
            exit 1
          fi
          (cd dist-ios && zip -qr FlacLess-iOS-unsigned.ipa Payload)
          unzip -tq dist-ios/FlacLess-iOS-unsigned.ipa
          rm -rf dist-ios/Payload dist-ios/DerivedData
          ls -lh dist-ios/FlacLess-iOS-unsigned.ipa

      - name: Upload FlacLess-iOS-unsigned.ipa Artifact
        uses: actions/upload-artifact@v4
        with:
          name: FlacLess-iOS-unsigned
          path: dist-ios/FlacLess-iOS-unsigned.ipa
          retention-days: 30

      - name: Publish GitHub Release (on tag or manual option)
        if: startsWith(github.ref, 'refs/tags/') || github.event.inputs.create_release == 'true'
        uses: softprops/action-gh-release@v2
        with:
          tag_name: \${{ startsWith(github.ref, 'refs/tags/') && github.ref_name || format('ios-build-{0}', github.run_number) }}
          name: FlacLess iOS v\${{ github.event.inputs.app_version || '2.5.1' }} (Build #\${{ github.run_number }})
          files: dist-ios/FlacLess-iOS-unsigned.ipa
          generate_release_notes: true
`;

/**
 * Parses either "owner/repo" or "https://github.com/owner/repo(.git)" into { owner, repo, slug }
 * @param {string} raw
 */
export function parseGitHubRepoInput(raw) {
    const cleaned = String(raw || '').trim();
    if (!cleaned) return null;

    const candidate = cleaned
        .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
        .replace(/^git@github\.com:/i, '')
        .replace(/\.git$/i, '')
        .replace(/^\/+|\/+$/g, '');

    const parts = candidate.split('/').filter(Boolean);
    if (parts.length < 2) return null;

    const owner = parts[0].trim();
    const repo = parts[1].trim();
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
        return null;
    }

    return { owner, repo, slug: `${owner}/${repo}` };
}

/**
 * Converts a bundle file entry ({ encoding, content }) to raw Uint8Array bytes
 * @param {{ encoding: 'utf8' | 'base64', content: string }} entry
 */
export function encodeEntryToBytes(entry) {
    if (!entry || typeof entry.content !== 'string') {
        return new Uint8Array(0);
    }
    if (entry.encoding === 'base64') {
        const binary = atob(entry.content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    return new TextEncoder().encode(entry.content);
}

/**
 * Encodes Uint8Array bytes into a base64 string without call-stack limits
 * @param {Uint8Array} bytes
 */
export function bytesToBase64(bytes) {
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const slice = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...slice);
    }
    return btoa(binary);
}

/**
 * Computes the exact Git blob SHA-1 ("blob <byteLength>\0" + rawBytes)
 * @param {Uint8Array} bytes
 */
export async function computeGitBlobSha1(bytes) {
    const header = new TextEncoder().encode(`blob ${bytes.byteLength}\0`);
    const payload = new Uint8Array(header.byteLength + bytes.byteLength);
    payload.set(header, 0);
    payload.set(bytes, header.byteLength);

    const digest = await globalThis.crypto.subtle.digest('SHA-1', payload);
    const view = new Uint8Array(digest);
    let hex = '';
    for (let i = 0; i < view.length; i += 1) {
        hex += view[i].toString(16).padStart(2, '0');
    }
    return hex;
}

/**
 * Decodes either gzipped (.bin) or plain JSON source bundle ArrayBuffer safely
 * @param {ArrayBuffer | Uint8Array} buffer
 */
export async function decodeSourceBundleBuffer(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let jsonText = '';

    const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (isGzip) {
        if (typeof DecompressionStream !== 'function') {
            throw new Error('Браузер не поддерживает DecompressionStream для распаковки исходников.');
        }
        const ds = new DecompressionStream('gzip');
        const stream = new Response(bytes).body.pipeThrough(ds);
        jsonText = await new Response(stream).text();
    } else {
        jsonText = new TextDecoder().decode(bytes);
    }

    const parsed = JSON.parse(jsonText);
    if (!parsed || !Array.isArray(parsed.files)) {
        throw new Error('Повреждённый архив исходников FlacLess.');
    }
    return parsed;
}

/**
 * Builds a single paste-ready shell command to push the current folder to GitHub & trigger build
 * @param {string} repoInput
 * @param {string} branch
 * @param {string} token
 */
export function buildOneCommandPushScript(repoInput, branch = 'main', token = '') {
    const parsed = parseGitHubRepoInput(repoInput);
    const slug = parsed ? parsed.slug : 'USERNAME/REPO';
    const safeBranch = String(branch || 'main').trim() || 'main';
    const safeToken = String(token || '').trim() || 'ВАШ_GITHUB_TOKEN';

    return [
        `git init`,
        `git checkout -B ${safeBranch}`,
        `git config user.name "FlacLess Builder"`,
        `git config user.email "builder@flacless.local"`,
        `git add -A`,
        `git commit -m "FlacLess iOS 1-click build" --allow-empty`,
        `git remote remove origin 2>/dev/null || true`,
        `git remote add origin "https://x-access-token:${safeToken}@github.com/${slug}.git"`,
        `git push -u origin ${safeBranch} --force`,
        `curl -fsSL -X POST -H "Authorization: Bearer ${safeToken}" -H "Accept: application/vnd.github+json" "https://api.github.com/repos/${slug}/actions/workflows/build-ios-ipa.yml/dispatches" -d '{"ref":"${safeBranch}","inputs":{"app_version":"2.5.1","create_release":"true"}}'`,
    ].join(' && ');
}
