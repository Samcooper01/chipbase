#!/usr/bin/env bash
# Launch PD-Leet on localhost. Creates a virtual environment on first run.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
    python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --quiet -r requirements.txt

exec uvicorn app.main:app --host 127.0.0.1 --port "${PORT:-8888}" "$@"
