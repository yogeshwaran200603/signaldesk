# SignalDesk &mdash; Quantitative Trading Signal Platform for Indian Equities

**SignalDesk** is an institutional-grade algorithmic trading signal engine and web platform tailored for Indian equities (NSE). It scans user-selected stocks using Smart Money Concepts (SMC), Volume Profile, and Price Action confluences. When high-probability setups form, the engine computes Entry, Stop Loss (SL), and Take Profit (TP), logs them to the Firestore dashboard, and dispatches instant alerts via the Meta WhatsApp Cloud API.

> [!IMPORTANT]
> **Signal Tool Only:** SignalDesk is strictly an educational signal generator and research tool. It **never** places automated trades or interacts with broker order management APIs.

For full architecture, operational commands, and deployment guides, refer to [`docs/README.md`](file:///c:/Users/Administrator/Documents/projects/REAL%20TIME%20TRADING%20BOT/docs/README.md).

## Quick Start

### Start Web + Engine Together (One Command)
From either the project root or `web/`:
```powershell
npm.cmd run dev:all
```
This launches both:
- **FastAPI Engine:** `http://localhost:8000` (Health check: `http://localhost:8000/api/health`)
- **Next.js Web (Turbopack):** `http://localhost:3000` (Live chart: `http://localhost:3000/live`)

Press `Ctrl+C` once to stop both processes cleanly.

### Run Services Individually
1. **Test Suite:**
   ```powershell
   engine\venv\Scripts\pytest -v
   ```
2. **Backend Engine Only:**
   ```powershell
   engine\venv\Scripts\python -m uvicorn engine.api.main:app --host 0.0.0.0 --port 8000
   ```
3. **Next.js Web App Only (Turbopack):**
   ```powershell
   cd web
   npm.cmd run dev
   ```
