"""Angel One SmartAPI client wrapper for SignalDesk.

Handles:
- Automated TOTP login with pyotp
- Session management & auto re-login on expiry
- OpenAPIScripMaster.json caching and symbol-token lookup (e.g., TCS-EQ, IDEA-EQ, OLAELEC-EQ)
- Historical candle fetching with interval chunking and rate-limit backoff
- Multi-interval support: ONE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE, ONE_HOUR, ONE_DAY, WEEKLY
- Pure, clean Pandas DataFrame output: [time, open, high, low, close, volume]
Never logs credentials, PINs, or raw session tokens.
"""

import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import pyotp
import requests
from SmartApi import SmartConnect

from engine.data.config import settings

logger = logging.getLogger("signaldesk.angel")

# Interval constants
INTERVAL_ONE_MINUTE = "ONE_MINUTE"
INTERVAL_FIVE_MINUTE = "FIVE_MINUTE"
INTERVAL_FIFTEEN_MINUTE = "FIFTEEN_MINUTE"
INTERVAL_ONE_HOUR = "ONE_HOUR"
INTERVAL_ONE_DAY = "ONE_DAY"
INTERVAL_WEEKLY = "WEEKLY"

# Max chunk days recommended per Angel API limits
CHUNK_LIMIT_DAYS = {
    INTERVAL_ONE_MINUTE: 25,
    INTERVAL_FIVE_MINUTE: 45,
    INTERVAL_FIFTEEN_MINUTE: 55,
    INTERVAL_ONE_HOUR: 120,
    INTERVAL_ONE_DAY: 365,
    INTERVAL_WEEKLY: 365,  # Fetches daily then resamples
}

SCRIP_MASTER_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"


CORE_NSE_SCRIPS: List[Dict[str, Any]] = [
    {"token": "2885", "symbol": "RELIANCE-EQ", "name": "RELIANCE", "exch_seg": "NSE"},
    {"token": "11536", "symbol": "TCS-EQ", "name": "TCS", "exch_seg": "NSE"},
    {"token": "1333", "symbol": "HDFCBANK-EQ", "name": "HDFCBANK", "exch_seg": "NSE"},
    {"token": "1594", "symbol": "INFY-EQ", "name": "INFY", "exch_seg": "NSE"},
    {"token": "4963", "symbol": "ICICIBANK-EQ", "name": "ICICIBANK", "exch_seg": "NSE"},
    {"token": "3045", "symbol": "SBIN-EQ", "name": "SBIN", "exch_seg": "NSE"},
    {"token": "10604", "symbol": "BHARTIARTL-EQ", "name": "BHARTIARTL", "exch_seg": "NSE"},
    {"token": "1660", "symbol": "ITC-EQ", "name": "ITC", "exch_seg": "NSE"},
    {"token": "11483", "symbol": "LT-EQ", "name": "LT", "exch_seg": "NSE"},
    {"token": "5900", "symbol": "AXISBANK-EQ", "name": "AXISBANK", "exch_seg": "NSE"},
    {"token": "1922", "symbol": "KOTAKBANK-EQ", "name": "KOTAKBANK", "exch_seg": "NSE"},
    {"token": "3456", "symbol": "TATAMOTORS-EQ", "name": "TATAMOTORS", "exch_seg": "NSE"},
    {"token": "3499", "symbol": "TATASTEEL-EQ", "name": "TATASTEEL", "exch_seg": "NSE"},
    {"token": "3351", "symbol": "SUNPHARMA-EQ", "name": "SUNPHARMA", "exch_seg": "NSE"},
    {"token": "10999", "symbol": "MARUTI-EQ", "name": "MARUTI", "exch_seg": "NSE"},
    {"token": "11630", "symbol": "NTPC-EQ", "name": "NTPC", "exch_seg": "NSE"},
    {"token": "3787", "symbol": "WIPRO-EQ", "name": "WIPRO", "exch_seg": "NSE"},
    {"token": "317", "symbol": "BAJFINANCE-EQ", "name": "BAJFINANCE", "exch_seg": "NSE"},
    {"token": "7229", "symbol": "HCLTECH-EQ", "name": "HCLTECH", "exch_seg": "NSE"},
    {"token": "14366", "symbol": "IDEA-EQ", "name": "IDEA", "exch_seg": "NSE"},
    {"token": "24757", "symbol": "OLAELEC-EQ", "name": "OLAELEC", "exch_seg": "NSE"},
]


class AngelClient:
    """SmartAPI client wrapper with automatic authentication and error recovery."""

    def __init__(self):
        self.api_key = settings.angel_api_key
        self.client_id = settings.angel_client_id
        self.pin = settings.angel_pin
        self.totp_secret = settings.angel_totp_secret

        self.smart_api: Optional[SmartConnect] = None
        self.jwt_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.feed_token: Optional[str] = None
        self.session_expiry: Optional[datetime] = None
        self.last_error: Optional[str] = None

        self._scrip_map: Dict[str, Dict[str, Any]] = {}
        self._scrip_list: List[Dict[str, Any]] = []
        self._scrip_loaded: bool = False

        for item in CORE_NSE_SCRIPS:
            sym = item["symbol"].upper()
            self._scrip_map[sym] = item
            if sym.endswith("-EQ"):
                self._scrip_map[sym[:-3]] = item
            self._scrip_list.append(item)

        self.cache_dir = Path(__file__).resolve().parent / "cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.scrip_cache_file = self.cache_dir / "OpenAPIScripMaster.json"

    @property
    def auth_token(self) -> Optional[str]:
        return self.jwt_token

    def login(self, force: bool = False) -> bool:
        """Logs into SmartAPI using client credentials and TOTP.

        Returns True on success, raises RuntimeError on authentication failure.
        """
        missing = settings.validate_angel_credentials()
        if missing:
            raise ValueError(f"Missing Angel One credentials: {', '.join(missing)}")

        if self.smart_api and self.jwt_token and not force:
            if self.session_expiry and datetime.now(timezone.utc) < self.session_expiry:
                return True

        logger.info("Initiating Angel One login with fresh TOTP...")
        try:
            totp = pyotp.TOTP(self.totp_secret).now()
            self.smart_api = SmartConnect(api_key=self.api_key)
            session_data = self.smart_api.generateSession(self.client_id, self.pin, totp)

            if not session_data or not session_data.get("status"):
                err_msg = session_data.get("message", "Unknown error") if session_data else "No response"
                logger.error(f"Angel One login failed: {err_msg}")
                raise RuntimeError(f"Angel One authentication failed: {err_msg}")

            data = session_data.get("data", {})
            self.jwt_token = data.get("jwtToken")
            self.refresh_token = data.get("refreshToken")
            self.feed_token = data.get("feedToken")
            # Sessions typically last ~24 hours; refresh safely within 12 hours
            self.session_expiry = datetime.now(timezone.utc) + timedelta(hours=12)

            logger.info("Angel One login successful.")
            return True

        except Exception as exc:
            logger.error(f"Angel One login encountered exception: {exc}")
            raise

    def relogin(self) -> bool:
        """Forces a fresh login session."""
        logger.info("Re-authenticating Angel One session...")
        return self.login(force=True)

    def load_scrip_master(self, force_refresh: bool = False) -> None:
        """Downloads or loads cached OpenAPIScripMaster.json and indexes NSE equity symbols."""
        if self._scrip_loaded and not force_refresh:
            return

        should_download = True
        if self.scrip_cache_file.exists() and not force_refresh:
            file_mtime = datetime.fromtimestamp(self.scrip_cache_file.stat().st_mtime, tz=timezone.utc)
            # Cache is valid for 24 hours
            if datetime.now(timezone.utc) - file_mtime < timedelta(hours=24):
                should_download = False

        if should_download:
            logger.info("Downloading latest OpenAPIScripMaster.json...")
            try:
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                resp = requests.get(SCRIP_MASTER_URL, headers=headers, timeout=60)
                resp.raise_for_status()
                with open(self.scrip_cache_file, "wb") as f:
                    f.write(resp.content)
                logger.info(f"OpenAPIScripMaster saved to cache ({len(resp.content)} bytes).")
            except Exception as exc:
                if self.scrip_cache_file.exists():
                    logger.warning(f"Download failed ({exc}), falling back to existing cache file.")
                else:
                    raise RuntimeError(f"Failed to fetch OpenAPIScripMaster: {exc}")

        logger.info("Indexing NSE equity symbols from ScripMaster...")
        with open(self.scrip_cache_file, "r", encoding="utf-8") as f:
            scrips = json.load(f)

        self._scrip_map = {}
        self._scrip_list = []

        for scrip in scrips:
            # We are interested in NSE equities
            if scrip.get("exch_seg") == "NSE":
                sym = scrip.get("symbol", "").strip()
                name = scrip.get("name", "").strip()
                token = scrip.get("token", "").strip()

                if not token or not sym:
                    continue

                item = {
                    "token": token,
                    "symbol": sym,
                    "name": name,
                    "tick_size": scrip.get("tick_size"),
                    "lotsize": scrip.get("lotsize"),
                    "exch_seg": "NSE",
                }

                # Store direct symbol e.g., "TCS-EQ"
                self._scrip_map[sym.upper()] = item

                # Also store without "-EQ" suffix e.g., "TCS" -> TCS-EQ info
                if sym.endswith("-EQ"):
                    base_sym = sym[:-3].upper()
                    if base_sym not in self._scrip_map:
                        self._scrip_map[base_sym] = item

                self._scrip_list.append(item)

        self._scrip_loaded = True
        logger.info(f"ScripMaster indexed {len(self._scrip_map)} NSE symbols.")

    def get_token_for_symbol(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Finds token details for a symbol (e.g. 'RELIANCE', 'RELIANCE-EQ', 'TCS', 'TCS-EQ')."""
        query = symbol.strip().upper()
        if query in self._scrip_map:
            return self._scrip_map[query]

        eq_query = f"{query}-EQ"
        if eq_query in self._scrip_map:
            return self._scrip_map[eq_query]

        if not self._scrip_loaded:
            try:
                self.load_scrip_master()
            except Exception as exc:
                logger.warning(f"ScripMaster load warning during lookup for {query}: {exc}")

        if query in self._scrip_map:
            return self._scrip_map[query]
        if eq_query in self._scrip_map:
            return self._scrip_map[eq_query]

        # Case-insensitive search through list
        for item in self._scrip_list:
            if item["symbol"].upper() == query or item["name"].upper() == query:
                return item

        return None

    def search_symbols(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Searches symbols and company names matching query string."""
        if not self._scrip_loaded and self.scrip_cache_file.exists():
            try:
                self.load_scrip_master()
            except Exception:
                pass

        q = query.strip().upper()
        if not q:
            return []

        exact_matches = []
        prefix_matches = []
        other_matches = []

        for item in self._scrip_list:
            sym = item["symbol"].upper()
            name = item["name"].upper()

            if sym == q or sym == f"{q}-EQ" or name == q:
                exact_matches.append(item)
            elif sym.startswith(q) or name.startswith(q):
                prefix_matches.append(item)
            elif q in sym or q in name:
                other_matches.append(item)

            if len(exact_matches) + len(prefix_matches) + len(other_matches) >= limit * 2:
                break

        results = exact_matches + prefix_matches + other_matches
        # Deduplicate
        seen = set()
        deduped = []
        for r in results:
            if r["symbol"] not in seen:
                seen.add(r["symbol"])
                deduped.append(r)
            if len(deduped) >= limit:
                break

        return deduped

    def _execute_candle_request(
        self,
        token: str,
        interval: str,
        from_date_str: str,
        to_date_str: str,
        retries: int = 3,
    ) -> List[Any]:
        """Executes a single getCandleData call with session auto-refresh and rate-limit backoff."""
        if not self.smart_api:
            self.login()

        params = {
            "exchange": "NSE",
            "symboltoken": str(token),
            "interval": interval,
            "fromdate": from_date_str,
            "todate": to_date_str,
        }

        backoff = 1.5
        for attempt in range(1, retries + 1):
            try:
                if attempt > 1:
                    time.sleep(0.75)
                res = self.smart_api.getCandleData(params)

                if res and res.get("status"):
                    self.last_error = None
                    return res.get("data") or []

                err_msg = res.get("message", "") if res else ""
                err_code = str(res.get("errorcode", "")) if res else ""
                self.last_error = f"{err_msg} (code: {err_code})".strip()

                # Check for session expiration
                if "session" in err_msg.lower() or "token" in err_msg.lower() or err_code in ("AG8001", "AG8002", "AG8003"):
                    logger.warning("Session expired or invalid token during candle fetch. Re-logging in...")
                    self.relogin()
                    time.sleep(0.5)
                    continue

                # Check for rate limiting
                if "rate" in err_msg.lower() or "limit" in err_msg.lower() or "too many" in err_msg.lower():
                    logger.warning(f"Rate limited by Angel One (attempt {attempt}/{retries}). Backing off {backoff}s...")
                    time.sleep(backoff)
                    backoff *= 2.0
                    continue

                # If empty data returned for holidays or non-trading days
                if not res.get("data") and "success" in err_msg.lower():
                    return []

                logger.warning(f"Angel One candle API returned: {err_msg} (code: {err_code}) on attempt {attempt}")
                time.sleep(backoff)
                backoff *= 1.5

            except Exception as exc:
                self.last_error = str(exc)
                logger.warning(f"Exception during getCandleData attempt {attempt}/{retries}: {exc}")
                time.sleep(backoff)
                backoff *= 2.0

        return []

    def _fetch_direct_candles(
        self,
        token: str,
        symbol: str,
        interval: str,
        days: int = 30,
    ) -> pd.DataFrame:
        """Fetches candles directly from Angel One API in chunks."""
        fetch_interval = INTERVAL_ONE_DAY if interval == INTERVAL_WEEKLY else interval
        chunk_days = CHUNK_LIMIT_DAYS.get(fetch_interval, 30)

        now_dt = datetime.now()
        start_dt = now_dt - timedelta(days=days)

        chunks: List[Tuple[datetime, datetime]] = []
        cur_start = start_dt
        while cur_start < now_dt:
            cur_end = min(cur_start + timedelta(days=chunk_days), now_dt)
            chunks.append((cur_start, cur_end))
            cur_start = cur_end

        all_rows: List[List[Any]] = []
        for c_start, c_end in chunks:
            from_str = c_start.strftime("%Y-%m-%d 09:15")
            to_str = c_end.strftime("%Y-%m-%d 15:30")

            rows = self._execute_candle_request(
                token=token,
                interval=fetch_interval,
                from_date_str=from_str,
                to_date_str=to_str,
            )
            if rows:
                all_rows.extend(rows)

        if not all_rows:
            logger.warning(f"No candle data returned for {symbol} [{interval}].")
            return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])

        df = pd.DataFrame(all_rows, columns=["time", "open", "high", "low", "close", "volume"])
        df["time"] = pd.to_datetime(df["time"])
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        df = df.dropna().drop_duplicates(subset=["time"]).sort_values("time").reset_index(drop=True)

        if interval == INTERVAL_WEEKLY:
            df = self._resample_weekly(df)

        return df

    def get_candles(
        self,
        symbol: str,
        interval: str,
        days: int = 30,
        force_refresh: bool = False,
    ) -> pd.DataFrame:
        """Fetches historical candles for a symbol, querying Supabase cache first.

        Args:
            symbol: Trading symbol (e.g., 'RELIANCE', 'RELIANCE-EQ', 'TCS', 'TCS-EQ')
            interval: ONE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE, ONE_HOUR, ONE_DAY, or WEEKLY
            days: Lookback window in calendar days
            force_refresh: Bypass cache and fetch directly from Angel One

        Returns:
            pd.DataFrame with columns: ['time', 'open', 'high', 'low', 'close', 'volume']
            sorted ascending by time.
        """
        from engine.data.candle_cache import CandleCacheManager
        return CandleCacheManager.get_candles(
            self,
            symbol=symbol,
            interval=interval,
            days=days,
            force_refresh=force_refresh,
        )

    def get_ltp(self, symbol: str, token: Optional[str] = None) -> float:
        """Fetches real-time LTP for an NSE symbol via Angel One SmartAPI."""
        info = self.get_token_for_symbol(symbol)
        actual_symbol = info["symbol"] if info else symbol.strip().upper()
        actual_token = str(token or (info["token"] if info else ""))
        if not actual_token:
            raise ValueError(f"Could not resolve Angel One token for symbol '{symbol}'.")

        if not self.smart_api:
            self.login()

        res = self.smart_api.ltpData("NSE", actual_symbol, actual_token)
        if res and res.get("status") and res.get("data"):
            ltp_val = res["data"].get("ltp")
            if ltp_val is not None:
                return float(ltp_val)

        err_msg = res.get("message", "Unknown LTP error") if res else "Empty LTP response"
        raise RuntimeError(f"Angel One LTP request failed for {actual_symbol}: {err_msg}")

    @staticmethod
    def _resample_weekly(df: pd.DataFrame) -> pd.DataFrame:
        """Resamples daily OHLCV DataFrame into weekly OHLCV bars (ending Friday)."""
        if df.empty:
            return df

        df = df.copy()
        df.set_index("time", inplace=True)
        weekly = df.resample("W-FRI").agg({
            "open": "first",
            "high": "max",
            "low": "min",
            "close": "last",
            "volume": "sum",
        }).dropna().reset_index()

        return weekly
