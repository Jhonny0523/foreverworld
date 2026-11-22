@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Servidor Forever World - Miscolandia

set "JAVA_BIN=%LOCALAPPDATA%\Packages\Microsoft.4297127D64EC6_8wekyb3d8bbwe\LocalCache\Local\runtime\java-runtime-epsilon\windows-x64\java-runtime-epsilon\bin\java.exe"
if not exist "%JAVA_BIN%" set "JAVA_BIN=C:\Program Files\Java\jdk-26.0.1\bin\java.exe"
if not exist "%JAVA_BIN%" (
  echo [ERROR] No se encontro Java 25/26 para ejecutar server.jar ^(Minecraft 26.4-snapshot requiere Java 25+^).
  echo Busca java-runtime-epsilon en tu instalador de Minecraft o instala JDK 25+.
  pause
  exit /b 1
)

if not exist "server.jar" (
  echo [ERROR] No existe server.jar. Ejecuta primero actualizar-snapshot.bat
  pause
  exit /b 1
)

if not exist "world\level.dat" (
  echo ============================================================================
  echo [!] No se encontro world\level.dat en "%cd%"
  echo Copia primero tu carpeta de partida aqui como "world\" ^(junto a server.jar^)
  echo o presiona ENTER solo si quieres crear un mundo vacio nuevo...
  echo ============================================================================
  pause >nul
)

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

echo ============================================================================
echo [Minecraft] Direccion Hamachi para conectarse: 25.45.82.35:10310
echo [Minecraft] Iniciando server.jar con Java 25+ (%JAVA_BIN%)...
echo ============================================================================
"%JAVA_BIN%" -Dfile.encoding=UTF-8 -Dstdin.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Xms2G -Xmx6G -jar server.jar nogui
echo.
echo [Minecraft] Servidor detenido. Puedes cerrar la ventana "Moderador IA Miscolandia".
pause
