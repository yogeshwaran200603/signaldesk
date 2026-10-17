@echo off
setlocal
cd /d "%~dp0"
title SignalDesk Quant Engine (Port 8000)

echo ===================================================
echo [SignalDesk] Starting FastAPI Quant Engine on :8000
echo ===================================================

set "PYTHONPATH=%~dp0"

set "PYTHON_EXE=%~dp0engine\venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
    echo [SignalDesk] venv python not found, checking system python...
    set "PYTHON_EXE=python"
)

echo [SignalDesk] Working Directory: %CD%
echo [SignalDesk] Python Executable: %PYTHON_EXE%
echo [SignalDesk] Starting FastAPI on http://localhost:8000 ...
echo [SignalDesk] (Initialization connects to market feeds and takes ~5-8 seconds)
echo.

"%PYTHON_EXE%" -m uvicorn engine.api.main:app --host 0.0.0.0 --port 8000

echo.
echo [SignalDesk] Engine process ended.
pause
