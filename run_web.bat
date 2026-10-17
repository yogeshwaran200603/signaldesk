@echo off
setlocal
cd /d "%~dp0web"
title SignalDesk Web Frontend (Port 3000)

echo ===================================================
echo [SignalDesk] Starting Next.js Web on http://localhost:3000
echo ===================================================

if not exist "%~dp0web\node_modules" (
    echo [SignalDesk] Installing web dependencies...
    call npm.cmd install
)

call npm.cmd run dev

echo.
echo [SignalDesk] Web server process ended.
pause
