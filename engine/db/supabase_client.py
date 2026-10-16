"""Supabase client and analytics data access module for SignalDesk.

Connects to Supabase PostgreSQL using the server-side secret key (service role).
Validates SUPABASE_URL format and handles graceful retries and fallbacks.
Never logs or prints secrets.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from engine.data.config import settings

logger = logging.getLogger("signaldesk.supabase")

_supabase_client = None


def get_supabase_client():
    """Initializes and returns the Supabase client singleton.

    Raises:
        ValueError: If SUPABASE_URL or SUPABASE_SECRET_KEY is missing or invalid.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    validation_errors = settings.validate_supabase_credentials()
    if validation_errors:
        err_msg = f"Supabase configuration error: {'; '.join(validation_errors)}"
        logger.warning(err_msg)
        raise ValueError(err_msg)

    try:
        from supabase import create_client, ClientOptions

        url = settings.supabase_url.strip()
        key = settings.supabase_secret_key.strip()

        _supabase_client = create_client(
            url,
            key,
            options=ClientOptions(
                postgrest_client_timeout=10,
                storage_client_timeout=10,
            ),
        )
        logger.info("Supabase client successfully initialized.")
        return _supabase_client
    except Exception as exc:
        logger.error(f"Failed to initialize Supabase client: {exc}")
        raise


def is_supabase_configured() -> bool:
    """Returns True if Supabase credentials are validly configured."""
    return len(settings.validate_supabase_credentials()) == 0


def check_supabase_health() -> Dict[str, Any]:
    """Tests connection to Supabase and returns diagnostic health status."""
    if not is_supabase_configured():
        errors = settings.validate_supabase_credentials()
        return {
            "status": "UNCONFIGURED",
            "connected": False,
            "error": "; ".join(errors),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    try:
        client = get_supabase_client()
        # Ping via lightweight query on engine_events or candles
        client.table("engine_events").select("id").limit(1).execute()
        return {
            "status": "HEALTHY",
            "connected": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        logger.warning(f"Supabase health check connection test failed: {exc}")
        return {
            "status": "UNREACHABLE",
            "connected": False,
            "error": str(exc),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# ==============================================================================
# 1. CANDLE CACHE ACCESS
# ==============================================================================

def get_cached_candles(
    symbol: str,
    interval: str,
    start_ts: Optional[datetime] = None,
    end_ts: Optional[datetime] = None,
    limit: Optional[int] = 500,
    exchange: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Retrieves cached OHLCV candles from Supabase ordered by timestamp ascending."""
    if not is_supabase_configured():
        return []

    try:
        client = get_supabase_client()
        query = (
            client.table("candles")
            .select("symbol, asset_class, exchange, interval, ts, open, high, low, close, volume")
            .eq("symbol", symbol)
            .eq("interval", interval)
        )

        if exchange:
            query = query.eq("exchange", exchange)
        if start_ts:
            query = query.gte("ts", start_ts.isoformat())
        if end_ts:
            query = query.lte("ts", end_ts.isoformat())

        query = query.order("ts", desc=False)
        if limit:
            query = query.limit(limit)

        res = query.execute()
        return res.data or []
    except Exception as exc:
        logger.warning(f"Error reading candles from Supabase cache for {symbol} ({interval}): {exc}")
        return []


def upsert_cached_candles(candles: List[Dict[str, Any]]) -> int:
    """Upserts candles into Supabase candles table.

    Never caches candles where is_complete=False or incomplete open bars.
    """
    if not is_supabase_configured() or not candles:
        return 0

    valid_records = []
    for c in candles:
        # Filter out incomplete / in-progress candles
        if c.get("is_complete") is False:
            continue

        ts_val = c.get("ts") or c.get("time")
        if isinstance(ts_val, datetime):
            ts_str = ts_val.isoformat()
        else:
            ts_str = str(ts_val)

        valid_records.append(
            {
                "symbol": c["symbol"],
                "asset_class": c.get("asset_class", "equity"),
                "exchange": c.get("exchange", "NSE"),
                "interval": c["interval"],
                "ts": ts_str,
                "open": float(c["open"]),
                "high": float(c["high"]),
                "low": float(c["low"]),
                "close": float(c["close"]),
                "volume": float(c.get("volume", 0)),
            }
        )

    if not valid_records:
        return 0

    try:
        client = get_supabase_client()
        # Batch upsert in chunks of 500
        total_upserted = 0
        chunk_size = 500
        for i in range(0, len(valid_records), chunk_size):
            chunk = valid_records[i : i + chunk_size]
            client.table("candles").upsert(
                chunk,
                on_conflict="symbol,exchange,interval,ts",
            ).execute()
            total_upserted += len(chunk)

        logger.debug(f"Upserted {total_upserted} candles to Supabase cache.")
        return total_upserted
    except Exception as exc:
        logger.warning(f"Failed to upsert candles to Supabase: {exc}")
        return 0


# ==============================================================================
# 2. BACKTEST RUNS & TRADES ACCESS
# ==============================================================================

def save_backtest_run(
    run_id: str,
    symbol: str,
    trade_type: str,
    params: Dict[str, Any],
    metrics: Dict[str, Any],
    started_at: Optional[datetime] = None,
    finished_at: Optional[datetime] = None,
    asset_class: str = "equity",
    exchange: str = "NSE",
) -> bool:
    """Persists a completed backtest execution run to backtest_runs."""
    if not is_supabase_configured():
        return False

    record = {
        "id": run_id,
        "symbol": symbol,
        "asset_class": asset_class,
        "exchange": exchange,
        "trade_type": trade_type,
        "params": params,
        "metrics": metrics,
        "started_at": (started_at or datetime.now(timezone.utc)).isoformat(),
        "finished_at": (finished_at or datetime.now(timezone.utc)).isoformat(),
    }

    try:
        client = get_supabase_client()
        client.table("backtest_runs").upsert(record, on_conflict="id").execute()
        return True
    except Exception as exc:
        logger.warning(f"Failed to save backtest run {run_id} to Supabase: {exc}")
        return False


def save_backtest_trades(trades: List[Dict[str, Any]]) -> int:
    """Saves individual backtest simulated trades into backtest_trades."""
    if not is_supabase_configured() or not trades:
        return 0

    try:
        client = get_supabase_client()
        client.table("backtest_trades").upsert(trades, on_conflict="id").execute()
        return len(trades)
    except Exception as exc:
        logger.warning(f"Failed to save {len(trades)} backtest trades to Supabase: {exc}")
        return 0


def get_latest_backtest(symbol: str) -> Optional[Dict[str, Any]]:
    """Retrieves the latest backtest run metrics for a symbol."""
    if not is_supabase_configured():
        return None

    try:
        client = get_supabase_client()
        res = (
            client.table("backtest_runs")
            .select("*")
            .eq("symbol", symbol)
            .order("started_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]
        return None
    except Exception as exc:
        logger.warning(f"Failed to fetch backtest metrics for {symbol}: {exc}")
        return None


# ==============================================================================
# 3. SIGNAL OUTCOMES ANALYTICS MIRROR
# ==============================================================================

def upsert_signal_outcome(outcome_data: Dict[str, Any]) -> bool:
    """Upserts a resolved or tracked signal outcome into signal_outcomes table.

    Mirrors Firestore signal status transitions into Supabase for analytical preservation.
    """
    if not is_supabase_configured():
        return False

    signal_id = outcome_data.get("signal_id") or outcome_data.get("id")
    if not signal_id:
        return False

    status = outcome_data.get("status", "OPEN")
    rr = float(outcome_data.get("rr", 0.0))
    pnl_r = outcome_data.get("pnl_r")

    if pnl_r is None:
        if status == "TP HIT":
            pnl_r = rr if rr > 0 else 2.0
        elif status == "SL HIT":
            pnl_r = -1.0
        else:
            pnl_r = 0.0

    opened_at = outcome_data.get("opened_at") or outcome_data.get("createdAt")
    if isinstance(opened_at, datetime):
        opened_at_str = opened_at.isoformat()
    elif opened_at:
        opened_at_str = str(opened_at)
    else:
        opened_at_str = datetime.now(timezone.utc).isoformat()

    closed_at = outcome_data.get("closed_at") or outcome_data.get("closedAt")
    if isinstance(closed_at, datetime):
        closed_at_str = closed_at.isoformat()
    elif closed_at:
        closed_at_str = str(closed_at)
    else:
        closed_at_str = None

    record = {
        "signal_id": signal_id,
        "uid": outcome_data.get("uid", ""),
        "symbol": outcome_data.get("symbol", ""),
        "asset_class": outcome_data.get("asset_class") or outcome_data.get("assetClass", "equity"),
        "exchange": outcome_data.get("exchange", "NSE"),
        "trade_type": outcome_data.get("trade_type") or outcome_data.get("tradeType", "INTRADAY"),
        "side": outcome_data.get("side", "BUY"),
        "entry": float(outcome_data.get("entry", 0.0)),
        "sl": float(outcome_data.get("sl", 0.0)),
        "tp": float(outcome_data.get("tp", 0.0)),
        "rr": rr,
        "status": status,
        "opened_at": opened_at_str,
        "closed_at": closed_at_str,
        "exit_price": float(outcome_data["exitPrice"]) if outcome_data.get("exitPrice") else None,
        "pnl_r": float(pnl_r),
    }

    try:
        client = get_supabase_client()
        client.table("signal_outcomes").upsert(record, on_conflict="signal_id").execute()
        logger.info(f"Mirrored signal outcome {signal_id} to Supabase signal_outcomes.")
        return True
    except Exception as exc:
        logger.warning(f"Failed to upsert signal outcome {signal_id} to Supabase: {exc}")
        return False


def get_user_signal_outcomes(
    uid: str,
    trade_type: Optional[str] = None,
    symbol: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    asset_class: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Fetches signal outcomes for a specific uid from signal_outcomes table."""
    if not is_supabase_configured():
        return []

    try:
        client = get_supabase_client()
        query = client.table("signal_outcomes").select("*").eq("uid", uid)

        if asset_class and asset_class.upper() != "ALL":
            query = query.eq("asset_class", asset_class.lower())
        if trade_type and trade_type.upper() != "ALL":
            query = query.eq("trade_type", trade_type.upper())
        if symbol:
            query = query.eq("symbol", symbol.upper())
        if start_date:
            query = query.gte("opened_at", start_date)
        if end_date:
            query = query.lte("opened_at", end_date)

        query = query.order("opened_at", desc=False)
        res = query.execute()
        return res.data or []
    except Exception as exc:
        logger.warning(f"Failed to fetch signal outcomes for uid {uid}: {exc}")
        return []


# ==============================================================================
# 4. ML MODELS REGISTRY
# ==============================================================================

def save_ml_model_record(
    model_id: str,
    name: str,
    version: str,
    metrics: Dict[str, Any],
    path: str,
    active: bool = True,
) -> bool:
    """Records an ML model in the ml_models registry table."""
    if not is_supabase_configured():
        return False

    try:
        client = get_supabase_client()
        if active:
            # Set other models of this name to active=False
            client.table("ml_models").update({"active": False}).eq("name", name).execute()

        record = {
            "id": model_id,
            "name": name,
            "version": version,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "metrics": metrics,
            "path": path,
            "active": active,
        }
        client.table("ml_models").upsert(record, on_conflict="id").execute()
        return True
    except Exception as exc:
        logger.warning(f"Failed to save ML model record to Supabase: {exc}")
        return False


def get_active_ml_model_record(name: str = "confluence_filter") -> Optional[Dict[str, Any]]:
    """Loads the active ML model metadata from Supabase."""
    if not is_supabase_configured():
        return None

    try:
        client = get_supabase_client()
        res = (
            client.table("ml_models")
            .select("*")
            .eq("name", name)
            .eq("active", True)
            .order("trained_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]
        return None
    except Exception as exc:
        logger.warning(f"Failed to retrieve active ML model record: {exc}")
        return None


# ==============================================================================
# 5. ENGINE AUDIT EVENTS LOGGING
# ==============================================================================

def log_engine_event(level: str, message: str, meta: Optional[Dict[str, Any]] = None) -> bool:
    """Logs engine events to engine_events table (never logs secrets or full tokens)."""
    if not is_supabase_configured():
        return False

    safe_meta = {}
    if meta:
        for k, v in meta.items():
            # Sanitize keys that could contain secrets or tokens
            if any(s in k.lower() for s in ["key", "secret", "token", "password", "pin", "auth"]):
                safe_meta[k] = "***REDACTED***"
            else:
                safe_meta[k] = v

    record = {
        "level": level.upper(),
        "message": message[:500],
        "meta": safe_meta,
        "ts": datetime.now(timezone.utc).isoformat(),
    }

    try:
        client = get_supabase_client()
        client.table("engine_events").insert(record).execute()
        return True
    except Exception:
        # Never fail or crash execution for an audit log write
        return False
