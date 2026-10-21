param(
  [ValidateSet('patch', 'minor', 'major')]
  [string]$Bump = 'patch'
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
Set-Location $project

# Uma tentativa interrompida do electron-builder pode deixar este diretório
# temporário. Ele é artefato descartável da build, não dado do usuário.
$staleUnpacked = Join-Path $project 'release\win-unpacked.tmp'
if (Test-Path -LiteralPath $staleUnpacked) {
  Write-Host 'Limpando diretório temporário de uma build anterior...' -ForegroundColor DarkYellow
  try { Remove-Item -LiteralPath $staleUnpacked -Recurse -Force -ErrorAction Stop }
  catch { throw "Não foi possível limpar release\win-unpacked.tmp. Feche o DotaIACoach, o Explorer nessa pasta e tente novamente. Detalhe: $($_.Exception.Message)" }
}

git diff --quiet; $trackedDirty = $LASTEXITCODE -ne 0
git diff --cached --quiet; $stagedDirty = $LASTEXITCODE -ne 0
if ($trackedDirty -or $stagedDirty) {
  throw 'Há alterações não commitadas. Faça commit antes de gerar um instalador.'
}

Write-Host "Atualizando versão ($Bump)..." -ForegroundColor Cyan
npm.cmd version $Bump --no-git-tag-version
if ($LASTEXITCODE -ne 0) { throw 'Falha ao atualizar a versão.' }

$version = (Get-Content (Join-Path $project 'package.json') -Raw | ConvertFrom-Json).version
Write-Host "Gerando DotaIACoach $version..." -ForegroundColor Cyan
npm.cmd run package:win
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o instalador.' }

$installer = Join-Path $project "release\DotaIACoach-Setup-$version.exe"
$legacyInstaller = Join-Path $project "release\DotaIACoach Setup $version.exe"
if (Test-Path $legacyInstaller) { Move-Item -LiteralPath $legacyInstaller -Destination $installer -Force }
if (-not (Test-Path $installer)) { throw "Instalador não encontrado: $installer" }

Write-Host ''
Write-Host "Pronto: $installer" -ForegroundColor Green
Write-Host 'O mesmo appId preserva a instalação existente; execute este novo instalador por cima para atualizar.' -ForegroundColor Yellow
