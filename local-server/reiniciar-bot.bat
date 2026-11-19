@echo off
setlocal
cd /d "%~dp0"
title Reiniciar Moderador IA

rem Reinicia SOLO el bot moderador; el servidor de Minecraft sigue abierto.

echo [Bot] Cerrando el moderador anterior (si estaba abierto)...
if exist "bot.pid" (
  set /p OLDPID=<"bot.pid"
)
if defined OLDPID taskkill /PID %OLDPID% /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Moderador IA Miscolandia*" /T /F >nul 2>&1
timeout /t 1 >nul

where ollama >nul 2>&1
if %errorlevel%==0 (
  curl.exe -s http://127.0.0.1:11434/api/tags >nul 2>&1
  if errorlevel 1 (
    echo [Ollama] Iniciando servicio Ollama en segundo plano...
    start "Ollama Serve" /min cmd /c "ollama serve"
    timeout /t 2 >nul
  )
)

echo [Bot] Iniciando Moderador IA de Miscolandia en ventana aparte...
start "Moderador IA Miscolandia" cmd /k "cd /d "%~dp0" && node bot\moderator.mjs"

echo [OK] Listo. Esta ventana se cierra sola.
timeout /t 3 >nul
