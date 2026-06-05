@echo off
REM Dobbeltklikk denne fila (Windows) for aa starte Fiskeguru.
cd /d "%~dp0"
cls
echo.
echo   Starter Fiskeguru...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [X] Node.js mangler. Last ned "LTS" fra https://nodejs.org , installer,
  echo      og dobbeltklikk denne fila paa nytt.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo  Installerer ^(kun foerste gang, tar ca 1 min^)...
  call npm install
  echo.
)

if not defined PORT set PORT=3000

where tailscale >nul 2>nul && tailscale serve --bg %PORT% >nul 2>nul

start "" http://localhost:%PORT%

echo  Appen aapnes i nettleseren. La dette vinduet staa aapent.
echo  ^(Lukk vinduet for aa stoppe.^)
echo.
call npm start
pause
