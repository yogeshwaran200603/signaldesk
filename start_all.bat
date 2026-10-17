@echo off
setlocal
cd /d "%~dp0"
title SignalDesk Launcher

echo ===================================================
echo [SignalDesk] Starting Engine (:8000) and Web (:3000)
echo ===================================================
echo.
echo Launching FastAPI Quant Engine console...
start "SignalDesk Quant Engine (8000)" /D "%~dp0" cmd /k ""%~dp0run_engine.bat""

echo Launching Next.js Web Frontend console...
start "SignalDesk Web Frontend (3000)" /D "%~dp0web" cmd /k ""%~dp0run_web.bat""

echo.
echo ===================================================
echo Both server consoles have been launched!
echo - API Engine:  http://localhost:8000/api/health
echo - Web App:     http://localhost:3000
echo.
echo Note: Backend engine takes ~5-8 seconds to finish startup.
echo ===================================================
echo.
pause
