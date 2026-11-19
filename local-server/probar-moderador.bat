@echo off
setlocal
cd /d "%~dp0"
title Probar Moderador IA Miscolandia
node bot\moderator.mjs --smoke-test
pause
