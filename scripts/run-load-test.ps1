param(
  [Parameter(Mandatory = $true)][string]$MongoUri,
  [int]$VirtualUsers = 100,
  [int]$Stock = 20
)

if ($MongoUri -notmatch '/bespoke_load_test(?:\?|$)') { throw 'MongoUri must target the dedicated bespoke_load_test database.' }
if ($VirtualUsers -lt $Stock -or $Stock -lt 1) { throw 'VirtualUsers must be greater than or equal to Stock; Stock must be positive.' }

$root = Split-Path -Parent $PSScriptRoot
$env:MONGODB_URI = $MongoUri
$env:NODE_ENV = 'test'
$env:PORT = '3100'
$env:API_BASE_URL = 'http://localhost:3100'
$env:LOAD_TEST = 'true'
$env:LOAD_VUS = "$VirtualUsers"
$env:LOAD_STOCK = "$Stock"

npm run build
$server = Start-Process -FilePath 'node' -ArgumentList 'dist/server.js' -WorkingDirectory $root -WindowStyle Hidden -PassThru
try {
  $ready = $false
  1..20 | ForEach-Object { if (-not $ready) { Start-Sleep -Seconds 1; try { $ready = (Invoke-WebRequest -UseBasicParsing "$env:API_BASE_URL/healthz" -TimeoutSec 2).StatusCode -eq 200 } catch {} } }
  if (-not $ready) { throw 'Load-test server did not become healthy within 20 seconds.' }
  npx tsx scripts/load-test.ts
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}
