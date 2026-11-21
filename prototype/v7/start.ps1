$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required' }
if (-not $env:PORT) { $env:PORT = '4177' }
node serve.js
