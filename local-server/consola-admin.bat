@echo off
setlocal
cd /d "%~dp0"
title Consola Admin IA - Miscolandia
node bot\admin.mjs
if errorlevel 1 pause
