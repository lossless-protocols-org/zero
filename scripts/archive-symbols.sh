#!/usr/bin/env bash
# Collects one release's artefacts and symbols into
# references/play-vitals/symbols/v<version>-vc<code>/ (M25, v2.7.1), so a
# Play or App Store stack can be symbolicated later. Release-gate step 5.
#
#   scripts/archive-symbols.sh <version> <versionCode> [path/to/zero.xcarchive]
#
# Android pieces are required (AAB, APK, Hermes map); the APK's versionCode
# must match when aapt is available. With an Xcode archive, the iOS Hermes map
# (written by the bundle phase to ios/build/sourcemaps/) and the app dSYM are
# required too, and the map must not be older than the archive. Everything is
# staged in a temp folder and moved into place only when complete, so a
# failure never leaves a half-written folder that blocks the next run.
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: scripts/archive-symbols.sh <version> <versionCode> [path/to/zero.xcarchive]" >&2
  exit 1
fi
version=$1
code=$2
archive=${3:-}

root=$(cd "$(dirname "$0")/.." && pwd)
dest="${SYMBOLS_DIR:-$root/references/play-vitals/symbols}/v${version}-vc${code}"
outputs="$root/android/app/build/outputs"

fail() {
  echo "Refusing: $*" >&2
  exit 1
}

[[ -e "$dest" ]] && fail "$dest already exists."
[[ -z "$archive" || -d "$archive" ]] || fail "not an Xcode archive folder: $archive"

aab="$outputs/bundle/release/app-release.aab"
apk="$outputs/apk/release/app-release.apk"
map="$root/android/app/build/generated/sourcemaps/react/release/index.android.bundle.map"
for file in "$aab" "$apk" "$map"; do
  [[ -f "$file" ]] || fail "missing $file — build it first (bun run android:release, android:release:apk)."
done

# The APK must be the build being archived, not a leftover.
aapt=$(ls "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/nonexistent}}"/build-tools/*/aapt 2>/dev/null | tail -1 || true)
if [[ -n "$aapt" ]]; then
  apk_code=$("$aapt" dump badging "$apk" | sed -n "s/.*versionCode='\([0-9]*\)'.*/\1/p")
  [[ "$apk_code" == "$code" ]] || fail "the APK is versionCode $apk_code, not $code."
else
  echo "Note: aapt not found (set ANDROID_HOME); the APK's versionCode was not checked." >&2
fi

ios_map="$root/ios/build/sourcemaps/main.jsbundle.map"
if [[ -n "$archive" ]]; then
  [[ -f "$ios_map" ]] || fail "missing $ios_map — archive from Xcode (the bundle phase writes it)."
  # The bundle phase writes the map minutes before the archive's Info.plist;
  # a map more than an hour older belongs to an earlier build.
  map_age=$(( $(stat -f %m "$archive/Info.plist") - $(stat -f %m "$ios_map") ))
  (( map_age < 3600 )) || fail "$ios_map is older than the archive; it belongs to an earlier build."
  dsym="$archive/dSYMs/zero.app.dSYM"
  [[ -d "$dsym" ]] || fail "missing $dsym."
fi

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
cp "$aab" "$stage/app-release-vc${code}.aab"
cp "$apk" "$stage/app-release-vc${code}.apk"
cp "$map" "$stage/index.android.bundle.map"
if [[ -n "$archive" ]]; then
  mkdir -p "$stage/ios"
  cp "$ios_map" "$stage/ios/main.jsbundle.map"
  cp -R "$dsym" "$stage/ios/"
else
  echo "Note: no Xcode archive given; iOS map and dSYM not collected." >&2
fi
(cd "$stage" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS)

mkdir -p "$(dirname "$dest")"
mv "$stage" "$dest"
trap - EXIT
echo "Archived to $dest:"
(cd "$dest" && find . -type f | sort)
