#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
PORT="${PORT:-4188}" node serve.js
