#!/usr/bin/env bash
set -euo pipefail
package=ai.arena.dafter.next.trial20261023
mkdir -p device-evidence
capture() {
  adb logcat -d > device-evidence/logcat.txt 2>&1 || true
  adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/window.xml device-evidence/window.xml >/dev/null 2>&1 || true
  adb shell screencap -p /sdcard/device.png >/dev/null 2>&1 || true
  adb pull /sdcard/device.png device-evidence/device.png >/dev/null 2>&1 || true
}
trap capture EXIT
mkdir -p "$RUNNER_TEMP/prior-preview"
gh release download next-2.23-preview-39882663141 --repo "$GITHUB_REPOSITORY" \
  --pattern Daftari-Next-2.23-Preview.apk --dir "$RUNNER_TEMP/prior-preview"
adb install "$RUNNER_TEMP/prior-preview/Daftari-Next-2.23-Preview.apk" | tee device-evidence/prior-install.txt
adb install app/build/outputs/apk/debug/app-debug.apk | tee device-evidence/coexist-install.txt
adb shell pm path ai.arena.dafter.next.preview | tee device-evidence/prior-package.txt
adb shell pm path "$package" | tee device-evidence/new-package.txt
adb uninstall "$package" | tee device-evidence/uninstall.txt
adb install app/build/outputs/apk/debug/app-debug.apk | tee device-evidence/reinstall.txt
for name in prior-install coexist-install uninstall reinstall; do grep -q '^Success' "device-evidence/$name.txt"; done
# Installs the test APK and runs real WebView/IndexedDB/crypto/relaunch assertions.
set -o pipefail
./gradlew --no-daemon connectedDebugAndroidTest 2>&1 | tee device-evidence/instrumentation.txt || {
  python3 - <<'PY'
from pathlib import Path
text=Path('device-evidence/instrumentation.txt').read_text()[-6000:]
print('::error::'+text.replace('%','%25').replace('\r','%0D').replace('\n','%0A'))
PY
  exit 1
}
