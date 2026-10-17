@echo off
setlocal
cd /d "%~dp0"
title SignalDesk Unified Server (Port 8000 + 3000)

echo ===================================================
echo [SignalDesk] Starting Engine (:8000) + Web (:3000)
echo ===================================================
echo.

set "PYTHONPATH=%~dp0"
call npm.cmd run dev:all

echo.
echo [SignalDesk] Server stopped.
pause
