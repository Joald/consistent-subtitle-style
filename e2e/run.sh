#!/usr/bin/env bash
# Run E2E tests.  Starts Xvfb if it isn't already running on :99.
set -euo pipefail

DISPLAY_NUM=99

if ! ls /tmp/.X11-unix/X${DISPLAY_NUM} >/dev/null 2>&1; then
  echo "Starting Xvfb on :${DISPLAY_NUM}…"
  Xvfb :${DISPLAY_NUM} -screen 0 1920x1080x24 >/dev/null 2>&1 &
  XVFB_PID=$!
  sleep 2
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
fi

export DISPLAY=:${DISPLAY_NUM}

# Build first
echo "Building extension…"
bun run build

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXIT_CODE=0

# Run each E2E test file
for test_file in "$SCRIPT_DIR"/*.e2e.js; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Running $(basename "$test_file")…"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if ! bun "$test_file" "$@"; then
    EXIT_CODE=1
  fi
done

exit $EXIT_CODE
