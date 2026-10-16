"""Candle Cache Manager for SignalDesk (Equities & Crypto).

Coordinates reading historical OHLCV bars from Supabase PostgreSQL before calling
the market data provider (Angel One or CCXT), fetching only missing delta ranges,
and upserting closed bars.
Prevents caching incomplete current in-progress candles as final.
Gracefully degrades to direct provider calls if Supabase is offline.
"""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional
import pandas as pd
import pytz

from engine.data.angel_client import (
    INTERVAL_FIVE_MINUTE,
    INTERVAL_FIFTEEN_MINUTE,
    INTERVAL_ONE_HOUR,
    INTERVAL_ONE_DAY,
    INTERVAL_WEEKLY,
)
from engine.db.supabase_client import (
    get_cached_candles,
    upsert_cached_candles,
    is_supabase_configured,
)

logger = logging.getLogger("signaldesk.candle_cache")
IST = pytz.timezone("Asia/Kolkata")


def is_candle_complete(bar_time: datetime, interval: str, asset_class: str = "equity") -> bool:
    """Determines if a candle is completely closed based on current time.

    Current in-progress bars must NEVER be cached as final.
    """
    clean_class = (asset_class or "equity").strip().lower()
    if clean_class == "crypto":
        now_utc = datetime.now(timezone.utc)
        if bar_time.tzinfo is None:
            bar_utc = bar_time.replace(tzinfo=timezone.utc)
        else:
            bar_utc = bar_time.astimezone(timezone.utc)

        tf_map = {
            "5m": timedelta(minutes=5),
            INTERVAL_FIVE_MINUTE: timedelta(minutes=5),
            "15m": timedelta(minutes=15),
            INTERVAL_FIFTEEN_MINUTE: timedelta(minutes=15),
            "1h": timedelta(hours=1),
            INTERVAL_ONE_HOUR: timedelta(hours=1),
            "4h": timedelta(hours=4),
            "FOUR_HOUR": timedelta(hours=4),
            "1d": timedelta(days=1),
            INTERVAL_ONE_DAY: timedelta(days=1),
            "1w": timedelta(days=7),
            INTERVAL_WEEKLY: timedelta(days=7),
        }
        duration = tf_map.get(interval, tf_map.get(interval.lower(), timedelta(minutes=5)))
        return now_utc >= (bar_utc + duration)

    now_ist = datetime.now(IST)
    if bar_time.tzinfo is None:
        bar_time_ist = IST.localize(bar_time)
    else:
        bar_time_ist = bar_time.astimezone(IST)

    if interval in (INTERVAL_FIVE_MINUTE, "5m"):
        return now_ist >= (bar_time_ist + timedelta(minutes=5))
    elif interval in (INTERVAL_FIFTEEN_MINUTE, "15m"):
        return now_ist >= (bar_time_ist + timedelta(minutes=15))
    elif interval in (INTERVAL_ONE_HOUR, "1h"):
        return now_ist >= (bar_time_ist + timedelta(hours=1))
    elif interval in ("4h", "FOUR_HOUR"):
        return now_ist >= (bar_time_ist + timedelta(hours=4))
    elif interval in (INTERVAL_ONE_DAY, INTERVAL_WEEKLY, "1d", "1w", "weekly"):
        if now_ist.date() > bar_time_ist.date():
            return True
        elif now_ist.date() == bar_time_ist.date():
            return (now_ist.hour > 15) or (now_ist.hour == 15 and now_ist.minute >= 30)
        return False
    return True


class CandleCacheManager:
    """Manages Supabase + local disk candle caching and gap filling for AngelClient and DataProviders."""

    def __init__(self, angel_client: Any = None):
        self.angel_client = angel_client

    @staticmethod
    def _local_cache_file(angel_client: Any, symbol: str, interval: str):
        from pathlib import Path
        raw_dir = getattr(angel_client, "cache_dir", None)
        if not isinstance(raw_dir, Path):
            return None
        cache_dir = raw_dir / "candles"
        cache_dir.mkdir(parents=True, exist_ok=True)
        safe_sym = symbol.replace("/", "_").replace(":", "_").upper()
        return cache_dir / f"{safe_sym}_{interval.upper()}.json"

    @staticmethod
    def get_candles(
        angel_client,
        symbol: str,
        interval: str,
        days: int = 30,
        force_refresh: bool = False,
    ) -> pd.DataFrame:
        """Fetches NSE equity candles using Supabase + local disk cache, querying Angel One only for gaps."""
        import json

        scrip_info = angel_client.get_token_for_symbol(symbol)
        if not scrip_info:
            raise ValueError(f"Symbol '{symbol}' not found in Angel ScripMaster.")

        token = scrip_info["token"]
        actual_symbol = scrip_info["symbol"]
        now_utc = datetime.now(timezone.utc)
        start_utc = now_utc - timedelta(days=days)
        local_file = CandleCacheManager._local_cache_file(angel_client, actual_symbol, interval)

        # 1. Check Supabase Cache if available, else local disk cache
        cached_df = pd.DataFrame()
        if is_supabase_configured() and not force_refresh:
            try:
                cached_records = get_cached_candles(
                    symbol=actual_symbol,
                    interval=interval,
                    start_ts=start_utc,
                    end_ts=now_utc,
                    limit=2000,
                )
                if cached_records:
                    cached_df = pd.DataFrame(cached_records)
                    cached_df["time"] = pd.to_datetime(cached_df["ts"], format="ISO8601", errors="coerce")
                    cached_df = cached_df.drop(
                        columns=["ts", "symbol", "interval", "asset_class", "exchange"],
                        errors="ignore",
                    )
                    for col in ["open", "high", "low", "close", "volume"]:
                        cached_df[col] = pd.to_numeric(cached_df[col], errors="coerce")
                    cached_df = cached_df.sort_values("time").reset_index(drop=True)
                    logger.debug(f"Found {len(cached_df)} cached {interval} bars for {actual_symbol} in Supabase.")
            except Exception as exc:
                logger.warning(f"Error checking Supabase candle cache for {actual_symbol}: {exc}")
        elif not force_refresh and local_file is not None and local_file.exists():
            try:
                with open(local_file, "r", encoding="utf-8") as f:
                    local_records = json.load(f)
                if local_records:
                    cached_df = pd.DataFrame(local_records)
                    cached_df["time"] = pd.to_datetime(cached_df["time"], format="ISO8601", errors="coerce")
                    for col in ["open", "high", "low", "close", "volume"]:
                        cached_df[col] = pd.to_numeric(cached_df[col], errors="coerce")
                    cached_df = cached_df.dropna().sort_values("time").reset_index(drop=True)
            except Exception as exc:
                logger.debug(f"Local candle cache read notice for {actual_symbol}: {exc}")

        # Check if cache is fresh enough
        needs_fetch = False
        fetch_start_dt = start_utc

        if cached_df.empty:
            needs_fetch = True
            fetch_start_dt = start_utc
        else:
            latest_cached_time = cached_df["time"].iloc[-1].to_pydatetime()
            if latest_cached_time.tzinfo is None:
                latest_cached_time = latest_cached_time.replace(tzinfo=timezone.utc)

            # If NSE market is currently closed and we already have today/last session bars in cache, return immediately
            now_ist = datetime.now(IST)
            is_open_ist = (
                now_ist.weekday() < 5
                and (now_ist.replace(hour=9, minute=15, second=0, microsecond=0) <= now_ist <= now_ist.replace(hour=15, minute=30, second=0, microsecond=0))
            )
            max_age = (
                timedelta(minutes=5)
                if (is_open_ist and interval in ("ONE_MINUTE", "1m", INTERVAL_FIVE_MINUTE, "5m"))
                else timedelta(hours=12)
            )
            if now_utc - latest_cached_time > max_age:
                needs_fetch = True
                fetch_start_dt = latest_cached_time - timedelta(minutes=5)
            else:
                return cached_df

        # 2. Fetch missing delta from Angel One
        fetched_df = pd.DataFrame()
        fetch_days = max(1, (now_utc - fetch_start_dt).days + 1)
        try:
            logger.info(
                f"Fetching gap delta for {actual_symbol} [{interval}] from Angel One ({fetch_days} days)..."
            )
            fetched_df = angel_client._fetch_direct_candles(
                token=token,
                symbol=actual_symbol,
                interval=interval,
                days=fetch_days,
            )
        except Exception as exc:
            logger.warning(f"Angel One candle fetch failed for {actual_symbol}: {exc}")
            if not cached_df.empty:
                logger.info(f"Returning {len(cached_df)} cached bars as fallback.")
                return cached_df
            raise

        if fetched_df.empty and not cached_df.empty:
            return cached_df
        elif fetched_df.empty:
            return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])

        # 3. Upsert completed candles into Supabase (if configured)
        if is_supabase_configured() and not fetched_df.empty:
            try:
                completed_candles = []
                for _, row in fetched_df.iterrows():
                    bar_dt = row["time"].to_pydatetime() if hasattr(row["time"], "to_pydatetime") else row["time"]
                    if is_candle_complete(bar_dt, interval, asset_class="equity"):
                        completed_candles.append(
                            {
                                "symbol": actual_symbol,
                                "asset_class": "equity",
                                "exchange": "NSE",
                                "interval": interval,
                                "ts": bar_dt,
                                "open": float(row["open"]),
                                "high": float(row["high"]),
                                "low": float(row["low"]),
                                "close": float(row["close"]),
                                "volume": float(row.get("volume", 0)),
                                "is_complete": True,
                            }
                        )
                if completed_candles:
                    upsert_cached_candles(completed_candles)
            except Exception as exc:
                logger.warning(f"Failed to upsert new candles into Supabase: {exc}")

        # 4. Merge cached and newly fetched candles, deduplicate, sort, and persist to local disk cache
        if not cached_df.empty:
            combined = pd.concat([cached_df, fetched_df], ignore_index=True)
            combined = combined.drop_duplicates(subset=["time"]).sort_values("time").reset_index(drop=True)
        else:
            combined = fetched_df

        if local_file is not None:
            try:
                tail_to_save = combined.tail(500)
                serializable = [
                    {
                        "time": (r["time"].isoformat() if hasattr(r["time"], "isoformat") else str(r["time"])),
                        "open": float(r["open"]),
                        "high": float(r["high"]),
                        "low": float(r["low"]),
                        "close": float(r["close"]),
                        "volume": float(r.get("volume", 0)),
                    }
                    for _, r in tail_to_save.iterrows()
                ]
                with open(local_file, "w", encoding="utf-8") as f:
                    json.dump(serializable, f)
            except Exception as exc:
                logger.debug(f"Local candle cache write notice: {exc}")

        return combined

    @staticmethod
    def get_candles_with_provider(
        provider,
        symbol: str,
        interval: str,
        days: int = 30,
        asset_class: str = "crypto",
        exchange: str = "BINANCE",
        force_refresh: bool = False,
    ) -> pd.DataFrame:
        """Fetches candles for any DataProvider (e.g. CcxtProvider) using Supabase cache + delta fill."""
        now_utc = datetime.now(timezone.utc)
        start_utc = now_utc - timedelta(days=days)

        cached_df = pd.DataFrame()
        if is_supabase_configured() and not force_refresh:
            try:
                cached_records = get_cached_candles(
                    symbol=symbol,
                    interval=interval,
                    start_ts=start_utc,
                    end_ts=now_utc,
                    limit=2000,
                    exchange=exchange,
                )
                if cached_records:
                    cached_df = pd.DataFrame(cached_records)
                    cached_df["time"] = pd.to_datetime(cached_df["ts"], format="ISO8601", errors="coerce")
                    cached_df = cached_df.drop(
                        columns=["ts", "symbol", "interval", "asset_class", "exchange"],
                        errors="ignore",
                    )
                    for col in ["open", "high", "low", "close", "volume"]:
                        cached_df[col] = pd.to_numeric(cached_df[col], errors="coerce")
                    cached_df = cached_df.sort_values("time").reset_index(drop=True)
            except Exception as exc:
                logger.warning(f"Error checking Supabase candle cache for {symbol} ({exchange}): {exc}")

        fetch_start_dt = start_utc
        if not cached_df.empty:
            latest_cached_time = cached_df["time"].iloc[-1].to_pydatetime()
            if latest_cached_time.tzinfo is None:
                latest_cached_time = latest_cached_time.replace(tzinfo=timezone.utc)

            max_age = (
                timedelta(minutes=10)
                if interval in ("5m", INTERVAL_FIVE_MINUTE)
                else timedelta(minutes=30)
                if interval in ("15m", INTERVAL_FIFTEEN_MINUTE)
                else timedelta(hours=2)
            )
            if now_utc - latest_cached_time <= max_age:
                return cached_df
            fetch_start_dt = latest_cached_time - timedelta(minutes=15)

        fetch_days = max(1, (now_utc - fetch_start_dt).days + 1)
        try:
            fetched_df = provider._fetch_direct_candles(
                symbol=symbol,
                interval=interval,
                days=fetch_days,
            )
        except Exception as exc:
            logger.warning(f"Provider candle fetch failed for {symbol}: {exc}")
            if not cached_df.empty:
                return cached_df
            return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])

        if fetched_df.empty and not cached_df.empty:
            return cached_df
        elif fetched_df.empty:
            return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])

        if is_supabase_configured() and not fetched_df.empty:
            try:
                completed_candles = []
                for _, row in fetched_df.iterrows():
                    bar_dt = row["time"].to_pydatetime() if hasattr(row["time"], "to_pydatetime") else row["time"]
                    if is_candle_complete(bar_dt, interval, asset_class=asset_class):
                        completed_candles.append(
                            {
                                "symbol": symbol,
                                "asset_class": asset_class,
                                "exchange": exchange,
                                "interval": interval,
                                "ts": bar_dt,
                                "open": float(row["open"]),
                                "high": float(row["high"]),
                                "low": float(row["low"]),
                                "close": float(row["close"]),
                                "volume": float(row.get("volume", 0)),
                                "is_complete": True,
                            }
                        )
                if completed_candles:
                    upsert_cached_candles(completed_candles)
            except Exception as exc:
                logger.warning(f"Failed to upsert provider candles into Supabase: {exc}")

        if not cached_df.empty:
            combined = pd.concat([cached_df, fetched_df], ignore_index=True)
            combined = combined.drop_duplicates(subset=["time"]).sort_values("time").reset_index(drop=True)
            return combined

        return fetched_df


def fetch_cached_or_provider_candles(
    symbol: str,
    interval: str,
    days: int = 30,
    asset_class: str = "equity",
    exchange: str = "NSE",
    provider: Any = None,
) -> pd.DataFrame:
    """Convenience entry point for historical backtest runners and scanners.
    Coordinates local disk cache, Supabase PostgreSQL, and market data providers.
    """
    from pathlib import Path
    import json

    safe_sym = symbol.replace("/", "_").replace(":", "_").upper()
    cache_dir = Path(__file__).resolve().parent / "cache" / "candles"
    cache_file = cache_dir / f"{safe_sym}_{interval.upper()}.json"

    # 1. Try Provider / CandleCacheManager
    try:
        if asset_class.lower() == "equity":
            from engine.data.angel_client import AngelClient
            angel = getattr(provider, "client", None) or AngelClient()
            df = CandleCacheManager.get_candles(
                angel_client=angel,
                symbol=symbol,
                interval=interval,
                days=days,
            )
            if df is not None and not df.empty:
                return df
        else:
            if provider is not None:
                df = CandleCacheManager.get_candles_with_provider(
                    provider=provider,
                    symbol=symbol,
                    interval=interval,
                    days=days,
                    asset_class=asset_class,
                    exchange=exchange,
                )
                if df is not None and not df.empty:
                    return df
    except Exception as exc:
        logger.debug(f"Provider fetch notice for {symbol} ({interval}): {exc}")

    # 2. Disk Cache fallback across symbol and interval aliases
    sym_candidates = [safe_sym]
    if not safe_sym.endswith("-EQ") and asset_class.lower() == "equity":
        sym_candidates.append(f"{safe_sym}-EQ")
    elif safe_sym.endswith("-EQ"):
        sym_candidates.append(safe_sym[:-3])

    int_upper = interval.upper()
    int_candidates = [int_upper]
    int_alias_map = {
        "5M": ["FIVE_MINUTE", "5M"],
        "FIVE_MINUTE": ["5M", "FIVE_MINUTE"],
        "15M": ["FIFTEEN_MINUTE", "15M"],
        "FIFTEEN_MINUTE": ["15M", "FIFTEEN_MINUTE"],
        "1H": ["ONE_HOUR", "1H"],
        "ONE_HOUR": ["1H", "ONE_HOUR"],
        "1D": ["ONE_DAY", "1D"],
        "ONE_DAY": ["1D", "ONE_DAY"],
        "1W": ["WEEKLY", "1W"],
        "WEEKLY": ["1W", "WEEKLY"],
    }
    for alias in int_alias_map.get(int_upper, []):
        if alias not in int_candidates:
            int_candidates.append(alias)

    for s_name in sym_candidates:
        for i_name in int_candidates:
            c_file = cache_dir / f"{s_name}_{i_name}.json"
            if c_file.exists():
                try:
                    with open(c_file, "r", encoding="utf-8") as f:
                        records = json.load(f)
                    if records:
                        disk_df = pd.DataFrame(records)
                        disk_df["time"] = pd.to_datetime(disk_df["time"])
                        return disk_df.sort_values("time").reset_index(drop=True)
                except Exception:
                    pass

    return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])
