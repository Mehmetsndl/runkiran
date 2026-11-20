@echo off
chcp 65001 >nul
title RUNKIRAN Yerel Sunucu
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js bulunamadi. Once https://nodejs.org adresinden Node.js LTS surumunu kurun.
  echo.
  pause
  exit /b
)
node server\server.js 8000
pause
