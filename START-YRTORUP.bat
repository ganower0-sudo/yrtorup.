@echo off
setlocal
cd /d "%~dp0"
title YRTORUP Local Server
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  echo Install Node.js LTS from https://nodejs.org/ then run START-YRTORUP.bat again.
  pause
  exit /b 1
)
node --version
if errorlevel 1 (
  echo ERROR: Node.js could not start.
  pause
  exit /b 1
)
echo Starting YRTORUP. Keep this window open.
start "YRTORUP" cmd /c "timeout /t 2 /nobreak ^>nul ^& start http://127.0.0.1:8787"
node server.js
echo.
echo The server has stopped. Read any error above.
pause
