#!/bin/sh
# Runs the Swift tests on an available iPhone simulator: ios/ZeroShared (widget
# snapshot reader, money format, the outside-the-app queue, Siri matching),
# ios/ZeroBackup (the encrypted backup format against contracts/backup-format.json),
# ios/ZeroReports (the PDF renderer on contracts/report-doc.json) and
# ios/ZeroBilling (the App Store code, against Xcode's local test store; no
# network and no Apple account). Used by `bun run test:ios` and by CI, so both
# run the same thing.
set -eu
IOS="$(cd "$(dirname "$0")/../ios" && pwd)"
# The newest iOS runtime's first iPhone: simulator names differ between machines.
SIM=$(xcrun simctl list devices available -j | python3 -c '
import json, re, sys
devices = json.load(sys.stdin)["devices"]
# General runtimes only ("…iOS-27-2"): one built for a single device ("…iOS-27-2-iPhone19-4") is skipped.
version = lambda r: re.search(r"\.iOS-(\d+(?:-\d+)*)$", r)
runtimes = sorted((r for r in devices if version(r)), key=lambda r: [int(p) for p in version(r).group(1).split("-")], reverse=True)
print(next(d["udid"] for r in runtimes for d in devices[r] if d["name"].startswith("iPhone")))
')
echo "test-ios: simulator $SIM"
(cd "$IOS/ZeroShared" && xcodebuild test -scheme ZeroShared -destination "id=$SIM" -quiet)
(cd "$IOS/ZeroBackup" && xcodebuild test -scheme ZeroBackup -destination "id=$SIM" -quiet)
(cd "$IOS/ZeroReports" && xcodebuild test -scheme ZeroReports -destination "id=$SIM" -quiet)
# A test that waits on the store for ever fails after its allowance instead of hanging the run.
(cd "$IOS/ZeroBilling" && xcodebuild test -project ZeroBillingHost.xcodeproj -scheme ZeroBillingTests \
  -destination "id=$SIM" -test-timeouts-enabled YES -default-test-execution-time-allowance 60 \
  CODE_SIGNING_ALLOWED=NO -quiet)
