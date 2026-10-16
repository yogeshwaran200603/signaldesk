@echo off
cd /d "%~dp0"
echo ===================================================
echo [SignalDesk] Starting Engine and Web Frontend
echo ===================================================
start "SignalDesk Quant Engine (8000)" cmd /c "%~dp0run_engine.bat"
start "SignalDesk Web Frontend (3000)" cmd /c "%~dp0run_web.bat"
echo Both servers launched in independent background consoles.
