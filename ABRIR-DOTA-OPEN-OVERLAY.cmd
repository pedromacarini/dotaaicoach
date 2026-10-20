@echo off
setlocal
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="

if not exist "node_modules\electron\dist\electron.exe" (
  echo O aplicativo ainda nao foi preparado neste computador.
  echo Execute npm install uma vez e tente novamente.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  call npm run build
  if errorlevel 1 (
    echo Nao foi possivel preparar o aplicativo.
    pause
    exit /b 1
  )
)

start "" "%~dp0node_modules\electron\dist\electron.exe" .
endlocal
