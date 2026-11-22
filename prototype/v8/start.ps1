$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not $env:PORT) { $env:PORT = "4188" }
node .\serve.js
