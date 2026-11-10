#!/bin/sh
# Runs the Swift tests of ios/ZeroShared (widget snapshot reader, money format,
# the outside-the-app queue, Siri matching) on an available iPhone simulator.
# Used by `bun run test:ios` and by CI, so both run the same thing.
set -eu
cd "$(dirname "$0")/../ios/ZeroShared"
# The newest iOS runtime's first iPhone: simulator names differ between machines.
SIM=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devices = json.load(sys.stdin)["devices"]
runtimes = sorted((r for r in devices if ".iOS-" in r), key=lambda r: [int(p) for p in r.rsplit(".iOS-", 1)[1].split("-")], reverse=True)
print(next(d["udid"] for r in runtimes for d in devices[r] if d["name"].startswith("iPhone")))
')
echo "test-ios: simulator $SIM"
xcodebuild test -scheme ZeroShared -destination "id=$SIM" -quiet
