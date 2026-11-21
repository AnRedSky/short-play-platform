param(
  [int]$Port = 4173,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$url = "http://127.0.0.1:$Port/index.html"

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python3 -ErrorAction SilentlyContinue }
$node = Get-Command node -ErrorAction SilentlyContinue

if ($python) {
  $exe = $python.Source
  $serverArgs = @("-m", "http.server", "$Port", "--bind", "127.0.0.1")
} elseif ($node) {
  $exe = $node.Source
  $serverArgs = @((Join-Path $root "serve.js"), "$Port")
} else {
  Write-Host "未找到 Python 或 Node.js。请安装任意一个后重试，或使用其他静态服务器。" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "  长夜制作台 · V4 静态原型" -ForegroundColor Green
Write-Host "  $url" -ForegroundColor Cyan
Write-Host "  数据为纯内存态，刷新页面即恢复演示初始值。" -ForegroundColor DarkGray
Write-Host "  Ctrl+C 停止服务。" -ForegroundColor DarkGray
Write-Host ""

$browserJob = $null
if (-not $NoBrowser) {
  $browserJob = Start-Job -ScriptBlock {
    param($target)
    Start-Sleep -Milliseconds 1200
    Start-Process $target
  } -ArgumentList $url
}

Push-Location $root
try {
  & $exe @serverArgs
} finally {
  Pop-Location
  if ($browserJob) {
    Stop-Job $browserJob -ErrorAction SilentlyContinue
    Remove-Job $browserJob -Force -ErrorAction SilentlyContinue
  }
}
