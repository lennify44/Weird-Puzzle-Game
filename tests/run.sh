#!/bin/bash
# Headless-Firefox-Tests. Der erste Lauf legt ein Python-venv mit Selenium an.
set -e
cd "$(dirname "$0")/.."
VENV="${XDG_CACHE_HOME:-$HOME/.cache}/leuchtfeuer-tests"
[ -x "$VENV/bin/python" ] || { python3 -m venv "$VENV" && "$VENV/bin/pip" install -q selenium; }
"$VENV/bin/python" tests/play.py "$@"
