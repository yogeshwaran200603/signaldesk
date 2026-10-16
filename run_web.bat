@echo off
cd /d "%~dp0web"
echo [SignalDesk] Starting Next.js Web Application on http://localhost:3000 ...
call npm.cmd run dev
pause
