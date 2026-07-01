$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$packageDir = Join-Path $root '.deploy-package'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$zipLatest = Join-Path $root 'hr-duongminh-api-deploy.zip'
$zipVersioned = Join-Path $root ("hr-duongminh-api-deploy.$timestamp.zip")

Write-Host "Building backend..."
Push-Location $root
try {
  npm run build

  if (Test-Path $packageDir) {
    Remove-Item -LiteralPath $packageDir -Recurse -Force
  }

  New-Item -ItemType Directory -Path $packageDir | Out-Null

  Copy-Item -LiteralPath (Join-Path $root 'dist') -Destination $packageDir -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $root 'app.js') -Destination $packageDir -Force
  Copy-Item -LiteralPath (Join-Path $root 'package.json') -Destination $packageDir -Force
  Copy-Item -LiteralPath (Join-Path $root 'package-lock.json') -Destination $packageDir -Force
  Copy-Item -LiteralPath (Join-Path $root 'web.config') -Destination $packageDir -Force
  Copy-Item -LiteralPath (Join-Path $root '.env.example') -Destination $packageDir -Force

  $runtimeEnv = Join-Path $root '.env'
  $prodEnv = Join-Path $root '.env.prod'
  if (Test-Path $runtimeEnv) {
    Copy-Item -LiteralPath $runtimeEnv -Destination (Join-Path $packageDir '.env') -Force
  }
  elseif (Test-Path $prodEnv) {
    Copy-Item -LiteralPath $prodEnv -Destination (Join-Path $packageDir '.env') -Force
  }

  if (Test-Path $zipLatest) {
    Remove-Item -LiteralPath $zipLatest -Force
  }
  if (Test-Path $zipVersioned) {
    Remove-Item -LiteralPath $zipVersioned -Force
  }

  $packageItems = Get-ChildItem -LiteralPath $packageDir -Force | Select-Object -ExpandProperty FullName
  Compress-Archive -LiteralPath $packageItems -DestinationPath $zipLatest -Force
  Compress-Archive -LiteralPath $packageItems -DestinationPath $zipVersioned -Force

  Write-Host "Created:"
  Write-Host " - $zipLatest"
  Write-Host " - $zipVersioned"
}
finally {
  Pop-Location
}
