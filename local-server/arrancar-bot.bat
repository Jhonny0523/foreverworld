@echo off
setlocal
cd /d "%~dp0"
title Moderador IA Miscolandia

rem Arranca SOLO el bot moderador (el servidor de Minecraft sigue aparte).

where ollama >nul 2>&1
if %errorlevel%==0 (
  curl.exe -s http://127.0.0.1:11434/api/tags >nul 2>&1
  if errorlevel 1 (
    echo [Ollama] Iniciando servicio Ollama en segundo plano...
    start "Ollama Serve" /min cmd /c "ollama serve"
    timeout /t 2 >nul
  )
)

echo [Bot] Iniciando Moderador IA de Miscolandia...
node bot\moderator.mjs
echo.
echo [Bot] El moderador se detuvo.
pause
