"""DataProvider abstraction layer for SignalDesk (Equities via Angel One + Crypto via CCXT).

Provides a unified interface for:
- Symbol search & validation (`search_symbols`)
- Historical OHLCV candle fetching with chunking & Supabase cache (`get_candles`)
- Live price & 24h change percentage (`get_last_price`)
- Market hours & schedule inspection (`market_hours`)

Security & Operational Guarantees:
- Signals only; NEVER places orders or uses private trading keys on crypto exchanges.
- CCXT uses public endpoints only (`load_markets`, `fetch_ohlcv`, `fetch_ticker`) with `enableRateLimit=True`.
- Exponential backoff on NetworkError, RateLimitExceeded, and ExchangeNotAvailable; never crashes the scanner.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
import logging
import time
from typing import Any, Dict, List, Optional
import pandas as pd
import pytz

from engine.data.angel_client import (
    AngelClient,
    INTERVAL_FIVE_MINUTE,
    INTERVAL_FIFTEEN_MINUTE,
    INTERVAL_ONE_HOUR,
    INTERVAL_ONE_DAY,
    INTERVAL_WEEKLY,
)
from engine.data.config import settings

logger = logging.getLogger("signaldesk.providers")
IST = pytz.timezone("Asia/Kolkata")

# Default curated top crypto spot pairs (fallback & fast search index)
DEFAULT_CRYPTO_PAIRS: List[Dict[str, str]] = [
    {"symbol": "BTC/USDT", "name": "Bitcoin / Tether USDT"},
    {"symbol": "ETH/USDT", "name": "Ethereum / Tether USDT"},
    {"symbol": "SOL/USDT", "name": "Solana / Tether USDT"},
    {"symbol": "BNB/USDT", "name": "BNB / Tether USDT"},
    {"symbol": "XRP/USDT", "name": "XRP / Tether USDT"},
    {"symbol": "DOGE/USDT", "name": "Dogecoin / Tether USDT"},
    {"symbol": "ADA/USDT", "name": "Cardano / Tether USDT"},
    {"symbol": "AVAX/USDT", "name": "Avalanche / Tether USDT"},
    {"symbol": "LINK/USDT", "name": "Chainlink / Tether USDT"},
    {"symbol": "SUI/USDT", "name": "Sui / Tether USDT"},
    {"symbol": "DOT/USDT", "name": "Polkadot / Tether USDT"},
    {"symbol": "NEAR/USDT", "name": "NEAR Protocol / Tether USDT"},
    {"symbol": "LTC/USDT", "name": "Litecoin / Tether USDT"},
    {"symbol": "APT/USDT", "name": "Aptos / Tether USDT"},
    {"symbol": "UNI/USDT", "name": "Uniswap / Tether USDT"},
    {"symbol": "AAVE/USDT", "name": "Aave / Tether USDT"},
    {"symbol": "INJ/USDT", "name": "Injective / Tether USDT"},
    {"symbol": "ARB/USDT", "name": "Arbitrum / Tether USDT"},
    {"symbol": "OP/USDT", "name": "Optimism / Tether USDT"},
    {"symbol": "ATOM/USDT", "name": "Cosmos / Tether USDT"},
]

DEFAULT_FOREX_PAIRS: List[Dict[str, str]] = [
    {"symbol": "EUR/USD", "name": "Euro / US Dollar"},
    {"symbol": "GBP/USD", "name": "British Pound / US Dollar"},
    {"symbol": "USD/JPY", "name": "US Dollar / Japanese Yen"},
    {"symbol": "USD/INR", "name": "US Dollar / Indian Rupee"},
    {"symbol": "AUD/USD", "name": "Australian Dollar / US Dollar"},
    {"symbol": "USD/CHF", "name": "US Dollar / Swiss Franc"},
    {"symbol": "USD/CAD", "name": "US Dollar / Canadian Dollar"},
]

INTERVAL_ONE_MINUTE = "ONE_MINUTE"

# Timeframe mappings between canonical names, Angel One constants, and CCXT strings
ANGEL_INTERVAL_MAP: Dict[str, str] = {
    "1m": INTERVAL_ONE_MINUTE,
    "5m": INTERVAL_FIVE_MINUTE,
    "15m": INTERVAL_FIFTEEN_MINUTE,
    "1h": INTERVAL_ONE_HOUR,
    "1d": INTERVAL_ONE_DAY,
    "1w": INTERVAL_WEEKLY,
    "weekly": INTERVAL_WEEKLY,
    INTERVAL_ONE_MINUTE: INTERVAL_ONE_MINUTE,
    INTERVAL_FIVE_MINUTE: INTERVAL_FIVE_MINUTE,
    INTERVAL_FIFTEEN_MINUTE: INTERVAL_FIFTEEN_MINUTE,
    INTERVAL_ONE_HOUR: INTERVAL_ONE_HOUR,
    INTERVAL_ONE_DAY: INTERVAL_ONE_DAY,
    INTERVAL_WEEKLY: INTERVAL_WEEKLY,
}

CCXT_INTERVAL_MAP: Dict[str, str] = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
    "1w": "1w",
    "weekly": "1w",
    INTERVAL_ONE_MINUTE: "1m",
    INTERVAL_FIVE_MINUTE: "5m",
    INTERVAL_FIFTEEN_MINUTE: "15m",
    INTERVAL_ONE_HOUR: "1h",
    "FOUR_HOUR": "4h",
    INTERVAL_ONE_DAY: "1d",
    INTERVAL_WEEKLY: "1w",
}

INTERVAL_MINUTES_MAP: Dict[str, int] = {
    "1m": 1,
    "5m": 5,
    "15m": 15,
    "1h": 60,
    "4h": 240,
    "1d": 1440,
    "1w": 10080,
}

# Configurable timeframe sets per assetClass and tradeType
TRADE_TYPE_TIMEFRAMES: Dict[str, Dict[str, Dict[str, Any]]] = {
    "equity": {
        "INTRADAY": {
            "entry": "5m",
            "bias": "1h",
            "entry_days": 10,
            "bias_days": 60,
            "htf_bias": "1h",
            "mtf_structure": "15m",
            "ltf_entry": "5m",
            "htf_days": 60,
            "ltf_days": 10,
        },
        "DELIVERY": {
            "entry": "1d",
            "bias": "1w",
            "entry_days": 180,
            "bias_days": 365,
            "htf_bias": "1w",
            "mtf_structure": "1d",
            "ltf_entry": "1d",
            "htf_days": 365,
            "ltf_days": 180,
        },
    },
    "crypto": {
        "SCALP": {
            "entry": "5m",
            "bias": "15m",
            "entry_days": 5,
            "bias_days": 14,
            "htf_bias": "15m",
            "mtf_structure": "15m",
            "ltf_entry": "5m",
            "htf_days": 14,
            "ltf_days": 5,
        },
        "INTRADAY": {
            "entry": "15m",
            "bias": "1h",
            "entry_days": 10,
            "bias_days": 30,
            "htf_bias": "1h",
            "mtf_structure": "1h",
            "ltf_entry": "15m",
            "htf_days": 30,
            "ltf_days": 10,
        },
        "SWING": {
            "entry": "4h",
            "bias": "1d",
            "entry_days": 45,
            "bias_days": 180,
            "htf_bias": "1d",
            "mtf_structure": "4h",
            "ltf_entry": "1h",
            "htf_days": 180,
            "ltf_days": 45,
        },
    },
    "forex": {
        "SCALP": {
            "entry": "5m",
            "bias": "15m",
            "entry_days": 5,
            "bias_days": 14,
            "htf_bias": "15m",
            "mtf_structure": "15m",
            "ltf_entry": "5m",
            "htf_days": 14,
            "ltf_days": 5,
        },
        "SCALPING": {
            "entry": "5m",
            "bias": "15m",
            "entry_days": 5,
            "bias_days": 14,
            "htf_bias": "15m",
            "mtf_structure": "15m",
            "ltf_entry": "5m",
            "htf_days": 14,
            "ltf_days": 5,
        },
        "INTRADAY": {
            "entry": "15m",
            "bias": "1h",
            "entry_days": 10,
            "bias_days": 30,
            "htf_bias": "1h",
            "mtf_structure": "1h",
            "ltf_entry": "15m",
            "htf_days": 30,
            "ltf_days": 10,
        },
        "SWING": {
            "entry": "4h",
            "bias": "1d",
            "entry_days": 45,
            "bias_days": 180,
            "htf_bias": "1d",
            "mtf_structure": "4h",
            "ltf_entry": "1h",
            "htf_days": 180,
            "ltf_days": 45,
        },
    },
}


def encode_symbol_doc_id(symbol: str) -> str:
    """Safely encodes a symbol for Firestore document IDs (e.g. 'BTC/USDT' -> 'BTC_USDT')."""
    return symbol.strip().upper().replace("/", "_")


def normalize_crypto_symbol(symbol: str) -> str:
    """Normalizes crypto ticker inputs ('BTCUSDT', 'BTC_USDT', 'btc/usdt') to 'BTC/USDT'."""
    clean = symbol.strip().upper().replace("_", "/").replace("-", "/")
    if "/" not in clean:
        for quote in ("USDT", "USDC", "BTC", "ETH"):
            if clean.endswith(quote) and len(clean) > len(quote):
                base = clean[: -len(quote)]
                return f"{base}/{quote}"
        return f"{clean}/USDT"
    return clean


def map_to_canonical_interval(interval: str) -> str:
    """Maps any Angel or CCXT interval string to canonical ('5m', '15m', '1h', '4h', '1d', '1w')."""
    return CCXT_INTERVAL_MAP.get(interval, CCXT_INTERVAL_MAP.get(interval.lower(), "5m"))


class DataProvider(ABC):
    """Abstract base interface for market data providers."""

    asset_class: str = "equity"
    exchange_name: str = "NSE"

    @abstractmethod
    def search_symbols(self, query: str, limit: int = 12) -> List[Dict[str, Any]]:
        """Searches tradable symbols matching query."""

    @abstractmethod
    def get_candles(
        self,
        symbol: str,
        interval: str,
        days: int = 30,
        force_refresh: bool = False,
    ) -> pd.DataFrame:
        """Returns normalized OHLCV DataFrame: [time, open, high, low, close, volume]."""

    @abstractmethod
    def get_last_price(self, symbol: str, token: Optional[str] = None) -> Dict[str, Any]:
        """Returns {'ltp': float, 'changePct': float}."""

    @abstractmethod
    def market_hours(self) -> Dict[str, Any]:
        """Returns {'is_open': bool, 'schedule': str, 'timezone': str}."""


class AngelProvider(DataProvider):
    """NSE Equities data provider backed by Angel One SmartAPI."""

    asset_class = "equity"
    exchange_name = "NSE"

    def __init__(self, angel_client: Optional[AngelClient] = None):
        self.client = angel_client or AngelClient()

    def search_symbols(self, query: str, limit: int = 12) -> List[Dict[str, Any]]:
        results = self.client.search_symbols(query=query, limit=limit)
        enriched = []
        for item in results:
            enriched.append(
                {
                    **item,
                    "assetClass": "equity",
                    "exchange": item.get("exch_seg", "NSE"),
                }
            )
        return enriched

    def get_candles(
        self,
        symbol: str,
        interval: str,
        days: int = 30,
        force_refresh: bool = False,
    ) -> pd.DataFrame:
        angel_interval = ANGEL_INTERVAL_MAP.get(
            interval, ANGEL_INTERVAL_MAP.get(interval.lower(), INTERVAL_FIVE_MINUTE)
        )
        return self.client.get_candles(
            symbol=symbol,
            interval=angel_interval,
            days=days,
            force_refresh=force_refresh,
        )

    def get_last_price(self, symbol: str, token: Optional[str] = None) -> Dict[str, Any]:
        ltp = self.client.get_ltp(symbol=symbol, token=token)
        change_pct = 0.0
        try:
            df = self.client.get_candles(symbol=symbol, interval=INTERVAL_ONE_DAY, days=5)
            if not df.empty and len(df) >= 2:
                prev_close = float(df["close"].iloc[-2])
                if prev_close > 0:
                    change_pct = round(((ltp - prev_close) / prev_close) * 100.0, 2)
        except Exception:
            pass
        return {"ltp": round(float(ltp), 2), "changePct": change_pct}

    def market_hours(self) -> Dict[str, Any]:
        now_ist = datetime.now(IST)
        is_weekday = now_ist.weekday() < 5
        market_start = now_ist.replace(hour=9, minute=15, second=0, microsecond=0)
        market_end = now_ist.replace(hour=15, minute=30, second=0, microsecond=0)
        is_open = bool(is_weekday and (market_start <= now_ist <= market_end))
        return {
            "is_open": is_open,
            "schedule": "09:15-15:30 IST Mon-Fri",
            "timezone": "Asia/Kolkata",
        }


class CcxtProvider(DataProvider):
    """24/7 Cryptocurrency market data provider via CCXT (public endpoints only)."""

    asset_class = "crypto"

    def __init__(self, exchange_id: Optional[str] = None):
        self.exchange_id = (exchange_id or settings.crypto_exchange or "binance").strip().lower()
        self.exchange_name = self.exchange_id.upper()
        self._exchange = None
        self._markets_loaded = False
        self._cached_pairs: List[Dict[str, Any]] = []

    def _get_exchange(self):
        """Lazily initializes the public CCXT exchange instance with rate limiting enabled."""
        if self._exchange is not None:
            return self._exchange

        import ccxt

        exchange_cls = getattr(ccxt, self.exchange_id, None)
        if exchange_cls is None:
            logger.warning(f"Unknown CCXT exchange '{self.exchange_id}', falling back to binance.")
            self.exchange_id = "binance"
            self.exchange_name = "BINANCE"
            exchange_cls = ccxt.binance

        # Public endpoints ONLY — no apiKey or secret ever passed
        self._exchange = exchange_cls(
            {
                "enableRateLimit": True,
                "timeout": 15000,
                "options": {"defaultType": "spot"},
            }
        )
        return self._exchange

    def _call_with_retry(self, fn, *args, max_retries: int = 3, **kwargs):
        """Executes a public CCXT call with exponential backoff on transient network/rate errors."""
        import ccxt

        delay = 1.0
        for attempt in range(1, max_retries + 1):
            try:
                return fn(*args, **kwargs)
            except (ccxt.RateLimitExceeded, ccxt.ExchangeNotAvailable, ccxt.NetworkError) as exc:
                if attempt == max_retries:
                    logger.warning(
                        f"CCXT ({self.exchange_name}) failed after {max_retries} attempts: {exc}"
                    )
                    raise
                logger.debug(
                    f"CCXT transient error ({exc.__class__.__name__}), retrying in {delay:.1f}s (attempt {attempt}/{max_retries})..."
                )
                time.sleep(delay)
                delay *= 2.0
            except Exception as exc:
                logger.warning(f"CCXT error on {self.exchange_name}: {exc}")
                raise

    def _ensure_markets(self) -> List[Dict[str, Any]]:
        """Loads spot USDT pairs from exchange once, falling back to DEFAULT_CRYPTO_PAIRS if unreachable."""
        if self._markets_loaded and self._cached_pairs:
            return self._cached_pairs

        try:
            ex = self._get_exchange()
            markets = self._call_with_retry(ex.load_markets, max_retries=2)
            pairs: List[Dict[str, Any]] = []
            for sym, m in markets.items():
                if not m.get("active", True):
                    continue
                if m.get("spot", True) and m.get("quote") == "USDT":
                    base = m.get("base", sym.split("/")[0])
                    pairs.append(
                        {
                            "symbol": sym,
                            "token": sym,
                            "name": f"{base} / Tether USDT",
                            "exch_seg": self.exchange_name,
                            "assetClass": "crypto",
                            "exchange": self.exchange_name,
                        }
                    )
            if pairs:
                self._cached_pairs = pairs
                self._markets_loaded = True
                return self._cached_pairs
        except Exception as exc:
            logger.warning(f"Could not load live CCXT markets from {self.exchange_name}, using curated list: {exc}")

        self._cached_pairs = [
            {
                "symbol": p["symbol"],
                "token": p["symbol"],
                "name": p["name"],
                "exch_seg": self.exchange_name,
                "assetClass": "crypto",
                "exchange": self.exchange_name,
            }
            for p in DEFAULT_CRYPTO_PAIRS
        ]
        self._markets_loaded = True
        return self._cached_pairs

    def search_symbols(self, query: str, limit: int = 12) -> List[Dict[str, Any]]:
        q = query.strip().upper().replace("_", "/").replace("-", "/")
        if not q:
            return []

        pairs = self._ensure_markets()
        exact = []
        prefix = []
        contains = []

        for item in pairs:
            sym = item["symbol"].upper()
            base = sym.split("/")[0]
            name = item["name"].upper()

            if sym == q or base == q or sym.replace("/", "") == q.replace("/", ""):
                exact.append(item)
            elif sym.startswith(q) or base.startswith(q):
                prefix.append(item)
            elif q in sym or q in name:
                contains.append(item)

        return (exact + prefix + contains)[:limit]

    def _fetch_direct_candles(
        self,
        symbol: str,
        interval: str,
        days: int = 30,
    ) -> pd.DataFrame:
        """Fetches OHLCV candles from CCXT in chunks and normalises to UTC DataFrame."""
        norm_sym = normalize_crypto_symbol(symbol)
        ccxt_tf = CCXT_INTERVAL_MAP.get(interval, CCXT_INTERVAL_MAP.get(interval.lower(), "5m"))
        tf_minutes = INTERVAL_MINUTES_MAP.get(ccxt_tf, 5)
        tf_ms = tf_minutes * 60 * 1000

        now_utc = datetime.now(timezone.utc)
        start_utc = now_utc - timedelta(days=days)
        since_ms = int(start_utc.timestamp() * 1000)
        end_ms = int(now_utc.timestamp() * 1000)

        all_rows: List[List[Any]] = []
        max_Typed_chunks = 10
        chunk_limit = 1000

        try:
            ex = self._get_exchange()
            current_since = since_ms
            for _ in range(max_Typed_chunks):
                if current_since >= end_ms:
                    break
                batch = self._call_with_retry(
                    ex.fetch_ohlcv,
                    norm_sym,
                    timeframe=ccxt_tf,
                    since=current_since,
                    limit=chunk_limit,
                )
                if not batch:
                    break
                all_rows.extend(batch)
                last_ts = int(batch[-1][0])
                if last_ts <= current_since or len(batch) < chunk_limit:
                    break
                current_since = last_ts + tf_ms
        except Exception as exc:
            logger.warning(f"CCXT fetch_ohlcv failed for {norm_sym} ({ccxt_tf}): {exc}")
            return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])

        if not all_rows:
            return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])

        df = pd.DataFrame(
            all_rows,
            columns=["timestamp_ms", "open", "high", "low", "close", "volume"],
        )
        df["time"] = pd.to_datetime(df["timestamp_ms"], unit="ms", utc=True)
        df = df.drop(columns=["timestamp_ms"])
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        df = (
            df.dropna(subset=["time", "open", "high", "low", "close"])
            .drop_duplicates(subset=["time"])
            .sort_values("time")
            .reset_index(drop=True)
        )
        return df

    def get_candles(
        self,
        symbol: str,
        interval: str,
        days: int = 30,
        force_refresh: bool = False,
    ) -> pd.DataFrame:
        norm_sym = normalize_crypto_symbol(symbol)
        ccxt_tf = CCXT_INTERVAL_MAP.get(interval, CCXT_INTERVAL_MAP.get(interval.lower(), "5m"))
        try:
            from engine.data.candle_cache import CandleCacheManager

            return CandleCacheManager.get_candles_with_provider(
                provider=self,
                symbol=norm_sym,
                interval=ccxt_tf,
                days=days,
                asset_class="crypto",
                exchange=self.exchange_name,
                force_refresh=force_refresh,
            )
        except Exception as exc:
            logger.debug(f"Crypto candle cache fallback for {norm_sym}: {exc}")
            return self._fetch_direct_candles(symbol=norm_sym, interval=ccxt_tf, days=days)

    def get_last_price(self, symbol: str, token: Optional[str] = None) -> Dict[str, Any]:
        norm_sym = normalize_crypto_symbol(symbol)
        try:
            ex = self._get_exchange()
            ticker = self._call_with_retry(ex.fetch_ticker, norm_sym, max_retries=2)
            ltp = float(ticker.get("last") or ticker.get("close") or 0.0)
            change_pct = float(ticker.get("percentage") or 0.0)
            return {"ltp": ltp, "changePct": round(change_pct, 2)}
        except Exception as exc:
            logger.warning(f"CCXT fetch_ticker failed for {norm_sym}: {exc}")
            return {"ltp": 0.0, "changePct": 0.0}

    def market_hours(self) -> Dict[str, Any]:
        return {
            "is_open": True,
            "schedule": "24/7",
            "timezone": "UTC",
        }


class ForexProvider(DataProvider):
    """Configurable real-time Forex market data provider.

    Reads FOREX_PROVIDER and FOREX_API_KEY from engine/.env.
    If not configured, marks Forex as UNAVAILABLE rather than faking data.
    """

    asset_class = "forex"
    exchange_name = "FX"

    def __init__(self, provider_name: Optional[str] = None, api_key: Optional[str] = None):
        self.provider_name = (provider_name if provider_name is not None else settings.forex_provider).strip().lower()
        self.api_key = (api_key if api_key is not None else settings.forex_api_key).strip()
        if self.provider_name:
            self.exchange_name = self.provider_name.upper()

    def is_configured(self) -> bool:
        """Returns True only when a licensed/official FOREX_PROVIDER and FOREX_API_KEY are set."""
        return bool(self.provider_name and self.api_key)

    def search_symbols(self, query: str, limit: int = 12) -> List[Dict[str, Any]]:
        q = query.strip().upper().replace("_", "/").replace("-", "/")
        available = self.is_configured()
        results: List[Dict[str, Any]] = []
        for p in DEFAULT_FOREX_PAIRS:
            sym = p["symbol"].upper()
            name = p["name"].upper()
            if not q or q in sym or q in sym.replace("/", "") or q in name:
                results.append(
                    {
                        "symbol": p["symbol"],
                        "token": p["symbol"],
                        "name": p["name"],
                        "exch_seg": self.exchange_name,
                        "assetClass": "forex",
                        "exchange": self.exchange_name,
                        "available": available,
                    }
                )
        return results[:limit]

    def _fetch_direct_candles(
        self,
        symbol: str,
        interval: str,
        days: int = 30,
    ) -> pd.DataFrame:
        if not self.is_configured():
            return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])

        import requests

        norm_sym = symbol.strip().upper().replace("_", "/")
        if self.provider_name == "twelvedata":
            td_interval_map = {
                "1m": "1min",
                "5m": "5min",
                "15m": "15min",
                "1h": "1h",
                "4h": "4h",
                "1d": "1day",
                "1w": "1week",
            }
            td_int = td_interval_map.get(interval.lower(), "15min")
            try:
                resp = requests.get(
                    "https://api.twelvedata.com/time_series",
                    params={
                        "symbol": norm_sym,
                        "interval": td_int,
                        "outputsize": 300,
                        "apikey": self.api_key,
                        "timezone": "UTC",
                    },
                    timeout=10,
                )
                data = resp.json()
                values = data.get("values", [])
                if not values:
                    return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])
                df = pd.DataFrame(values)
                df["time"] = pd.to_datetime(df["datetime"], utc=True)
                for col in ["open", "high", "low", "close"]:
                    df[col] = pd.to_numeric(df[col], errors="coerce")
                df["volume"] = pd.to_numeric(df.get("volume", 1.0), errors="coerce").fillna(1.0)
                df = (
                    df[["time", "open", "high", "low", "close", "volume"]]
                    .dropna()
                    .sort_values("time")
                    .reset_index(drop=True)
                )
                return df
            except Exception as exc:
                logger.warning(f"Forex provider ({self.provider_name}) candle fetch failed for {norm_sym}: {exc}")

        return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])

    def get_candles(
        self,
        symbol: str,
        interval: str,
        days: int = 30,
        force_refresh: bool = False,
    ) -> pd.DataFrame:
        if not self.is_configured():
            return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])
        return self._fetch_direct_candles(symbol=symbol, interval=interval, days=days)

    def get_last_price(self, symbol: str, token: Optional[str] = None) -> Dict[str, Any]:
        if not self.is_configured():
            return {
                "ltp": 0.0,
                "changePct": 0.0,
                "available": False,
                "status": "UNAVAILABLE",
                "reason": "FOREX_PROVIDER and FOREX_API_KEY are not configured in engine/.env",
            }
        df = self._fetch_direct_candles(symbol=symbol, interval="5m", days=2)
        if df.empty:
            return {"ltp": 0.0, "changePct": 0.0, "available": True, "status": "UNAVAILABLE"}
        ltp = float(df["close"].iloc[-1])
        prev = float(df["open"].iloc[0]) if len(df) > 1 else ltp
        change_pct = round(((ltp - prev) / prev) * 100.0, 3) if prev > 0 else 0.0
        return {"ltp": round(ltp, 5), "changePct": change_pct, "available": True, "status": "LIVE"}

    def market_hours(self) -> Dict[str, Any]:
        if not self.is_configured():
            return {
                "is_open": False,
                "available": False,
                "status": "UNAVAILABLE",
                "schedule": "Requires FOREX_PROVIDER & FOREX_API_KEY in engine/.env",
                "timezone": "UTC",
            }
        now_utc = datetime.now(timezone.utc)
        # Forex runs 24/5 (Sun 22:00 UTC to Fri 22:00 UTC)
        wd = now_utc.weekday()
        is_open = not (wd == 5 or (wd == 4 and now_utc.hour >= 22) or (wd == 6 and now_utc.hour < 22))
        return {
            "is_open": is_open,
            "available": True,
            "status": "LIVE" if is_open else "CLOSED",
            "schedule": "24/5 Sun 22:00 - Fri 22:00 UTC",
            "timezone": "UTC",
        }


_angel_provider_instance: Optional[AngelProvider] = None
_ccxt_provider_instances: Dict[str, CcxtProvider] = {}
_forex_provider_instance: Optional[ForexProvider] = None


def get_provider(
    asset_class: str = "equity",
    exchange: Optional[str] = None,
    angel_client: Optional[AngelClient] = None,
    exchange_id: Optional[str] = None,
) -> DataProvider:
    """Factory returning the appropriate DataProvider for 'equity', 'crypto', or 'forex'."""
    global _angel_provider_instance, _forex_provider_instance
    clean_class = (asset_class or "equity").strip().lower()
    if clean_class == "crypto":
        ex_key = (exchange or exchange_id or settings.crypto_exchange or "binance").strip().lower()
        if ex_key not in _ccxt_provider_instances:
            _ccxt_provider_instances[ex_key] = CcxtProvider(exchange_id=ex_key)
        return _ccxt_provider_instances[ex_key]
    if clean_class == "forex":
        if _forex_provider_instance is None:
            _forex_provider_instance = ForexProvider()
        return _forex_provider_instance

    if angel_client is not None:
        return AngelProvider(angel_client=angel_client)
    if _angel_provider_instance is None:
        _angel_provider_instance = AngelProvider()
    return _angel_provider_instance
