@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Consola Admin IA - Miscolandia
node bot\admin.mjs
if errorlevel 1 pause
