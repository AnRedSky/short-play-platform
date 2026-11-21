#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Node.js is required"; exit 1; }
PORT="${PORT:-4177}" node serve.js
