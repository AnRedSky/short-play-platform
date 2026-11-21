#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-4173}"
URL="http://127.0.0.1:${PORT}/index.html"
cd "$DIR"

if command -v python3 >/dev/null 2>&1; then
  SERVER=(python3 -m http.server "$PORT" --bind 127.0.0.1)
elif command -v python >/dev/null 2>&1; then
  SERVER=(python -m http.server "$PORT" --bind 127.0.0.1)
elif command -v node >/dev/null 2>&1; then
  SERVER=(node serve.js "$PORT")
else
  echo "未找到 Python 或 Node.js，请安装任意一个后重试。" >&2
  exit 1
fi

echo ""
echo "  长夜制作台 · V4 静态原型"
echo "  $URL"
echo "  数据为纯内存态，刷新页面即恢复演示初始值。"
echo "  Ctrl+C 停止服务。"
echo ""

(
  sleep 1.2
  if command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 || true
  fi
) &

exec "${SERVER[@]}"
