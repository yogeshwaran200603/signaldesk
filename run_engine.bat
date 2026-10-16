@echo off
cd /d "%~dp0"
echo [SignalDesk] Starting FastAPI Quant Engine on http://localhost:8000 ...
engine\venv\Scripts\python.exe -m uvicorn engine.api.main:app --host 0.0.0.0 --port 8000
pause
