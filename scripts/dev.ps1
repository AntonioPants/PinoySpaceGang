# Field Shift on Windows (PowerShell). Usage:
#   .\scripts\dev.ps1 setup      # once
#   .\scripts\dev.ps1 start      # engine (:8000) + web (:3000) in two windows
#   .\scripts\dev.ps1 offline    # same, but engine never touches the network (demo safety)
#   .\scripts\dev.ps1 test
param([string]$task = "start")
$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root "engine\.venv\Scripts\python.exe"
switch ($task) {
  "setup" {
    python -m venv (Join-Path $root "engine\.venv")
    & $py -m pip install -r (Join-Path $root "engine\requirements.txt")
    Push-Location (Join-Path $root "web"); npm install; npm run build; Pop-Location
  }
  { $_ -in "start", "offline" } {
    $envPrefix = if ($task -eq "offline") { '$env:FIELDSHIFT_OFFLINE="1"; ' } else { '' }
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "$envPrefix Set-Location '$root\engine'; & '$py' -m uvicorn fieldshift.api:app --port 8000"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\web'; npm run start"
    Write-Host "Engine: http://localhost:8000/docs   App: http://localhost:3000"
  }
  "test" {
    Push-Location (Join-Path $root "engine"); & $py -m pytest; Pop-Location
    Push-Location (Join-Path $root "web"); npm run typecheck; Pop-Location
  }
}
