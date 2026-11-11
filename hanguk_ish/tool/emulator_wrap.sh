#!/usr/bin/env bash
# Before the emulator starts (ish-smoke.yml): puts a small wrapper in place of
# $ANDROID_HOME/emulator/emulator that sends the emulator's own output to
# build/smoke/emulator-output.txt. The action reads that output only while
# the emulator boots; when the emulator goes away later, its last words are
# kept in the file.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/smoke
log="$PWD/build/smoke/emulator-output.txt"
dir="$ANDROID_HOME/emulator"
if grep -qs emulator.real "$dir/emulator"; then
  exit 0
fi
mv "$dir/emulator" "$dir/emulator.real"
# Line-buffered (stdbuf), so the last lines before an abrupt end are kept;
# the exit status says how it ended (134 abort, 137 killed, 139 crash).
cat >"$dir/emulator" <<WRAPPER
#!/bin/sh
echo "=== \$(date -u +%H:%M:%S) emulator \$*" >>"$log"
stdbuf -oL -eL "$dir/emulator.real" "\$@" >>"$log" 2>&1
status=\$?
echo "=== \$(date -u +%H:%M:%S) emulator exited with status \$status" >>"$log"
exit \$status
WRAPPER
chmod +x "$dir/emulator"
echo "emulator output → $log"
