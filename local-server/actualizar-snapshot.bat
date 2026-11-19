@echo off
setlocal
cd /d "%~dp0"
title Actualizar Snapshot Oficial Mojang
node update-snapshot.mjs
pause
