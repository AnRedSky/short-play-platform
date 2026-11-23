# V9 静态原型启动（Windows / PowerShell）
# 用法：.\start.ps1   （可选：.\start.ps1 -Port 4191）

param(
  [int]$Port = 4190
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "未检测到 Node.js：本原型需要 Node 运行静态服务（也支持任意静态服务器）。" -ForegroundColor Red
  exit 1
}

$env:PORT = $Port
Write-Host "FRAME 短剧工场 V9 · 静态原型" -ForegroundColor Cyan
Write-Host "地址：http://localhost:$Port/" -ForegroundColor Green
Write-Host "注意：必须通过 HTTP 访问，直接双击 index.html 会因浏览器安全策略无法加载脚本。"
Write-Host "按 Ctrl+C 停止服务。" -ForegroundColor DarkGray

node .\serve.js
