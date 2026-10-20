@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\release-installer.ps1" %*
if errorlevel 1 (
  echo.
  echo Falha ao gerar o instalador.
  pause
  exit /b 1
)
echo.
pause
