@echo off
setlocal
cd /d "%~dp0"
title Respaldo de Mundo - Forever World

if not exist "world\level.dat" (
  echo [ERROR] No existe world\level.dat en "%cd%"
  pause
  exit /b 1
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd-HHmmss'"`) do set "STAMP=%%I"
set "DEST=backups\world-%STAMP%"
if not exist "backups" mkdir "backups"

echo Copiando world\ a "%DEST%" (sin session.lock)...
robocopy "world" "%DEST%" /E /XF session.lock /NFL /NDL /NJH /NJS >nul
if %errorlevel% GEQ 8 (
  echo [ERROR] Fallo robocopy con codigo %errorlevel%
  pause
  exit /b 1
)
echo [OK] Respaldo guardado en "%cd%\%DEST%".
pause
