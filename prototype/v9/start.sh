#!/usr/bin/env bash
# V9 静态原型启动（macOS / Linux）
# 用法：./start.sh [端口]

set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js：本原型需要 Node 运行静态服务（也支持任意静态服务器）。"
  exit 1
fi

export PORT="${1:-4190}"
echo "FRAME 短剧工场 V9 · 静态原型"
echo "地址：http://localhost:${PORT}/"
echo "注意：必须通过 HTTP 访问，直接双击 index.html 会因浏览器安全策略无法加载脚本。"
echo "按 Ctrl+C 停止服务。"

node ./serve.js
