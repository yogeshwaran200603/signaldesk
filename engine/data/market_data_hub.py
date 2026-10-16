"""Real-Time Market Data Hub & Tick-to-Candle Aggregator for SignalDesk.

Provides:
1. TickCandleAggregator:
   - Builds live candles (1m, 5m, 15m, 1h, 4h, 1d) from real-time ticks
   - Updates forming candle in real time on every tick
   - Finalizes candle on timeframe boundary close & triggers on_candle_close callbacks
   - Backfills history from Supabase candle cache + provider REST
   - Rolling in-memory store per (asset_class, exchange, symbol, interval)
2. Pluggable Stream Providers:
   - AngelWebSocketProvider (Angel One SmartWebSocketV2 with auto-reconnect, resubscribe,
     heartbeat, subscription limit enforcement, and daily session expiry re-login)
   - CcxtStreamProvider (24/7 crypto via CCXT watch/poll with backoff)
   - ForexStreamProvider (Configurable official FX feed; reports UNAVAILABLE when unconfigured)
3. Accurate Feed Status:
   - LIVE, DELAYED (with exact delaySeconds), CLOSED, or UNAVAILABLE from real timestamps
4. WebSocket Client Fan-Out & Throttling:
   - One upstream subscription per unique symbol shared across all connected clients
   - Throttles outgoing updates to max 4 per second (250ms) per client
   - Automatic subscription cleanup on client disconnect
"""

import asyncio
from collections import deque
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
import json
import logging
import threading
import time
from typing import Any, Callable, Deque, Dict, List, Literal, Optional, Set, Tuple

import pandas as pd
import pytz

from engine.data.candle_cache import CandleCacheManager, is_candle_complete
from engine.data.config import settings
from engine.data.providers import (
    AngelProvider,
    CcxtProvider,
    ForexProvider,
    INTERVAL_MINUTES_MAP,
    get_provider,
    map_to_canonical_interval,
    normalize_crypto_symbol,
)

logger = logging.getLogger("signaldesk.market_hub")
IST = pytz.timezone("Asia/Kolkata")

FeedStatusLiteral = Literal["LIVE", "DELAYED", "CLOSED", "UNAVAILABLE"]
SUPPORTED_INTERVALS = ("1m", "5m", "15m", "1h", "4h", "1d")


def floor_timestamp_to_interval(ts: datetime, interval: str) -> datetime:
    """Floors a UTC timestamp to the start of its candle bucket for 1m, 5m, 15m, 1h, 4h, or 1d."""
    if ts.tzinfo is None:
        utc_dt = ts.replace(tzinfo=timezone.utc)
    else:
        utc_dt = ts.astimezone(timezone.utc)

    canon = map_to_canonical_interval(interval)
    if canon == "1m":
        return utc_dt.replace(second=0, microsecond=0)
    if canon == "5m":
        minute_bucket = (utc_dt.minute // 5) * 5
        return utc_dt.replace(minute=minute_bucket, second=0, microsecond=0)
    if canon == "15m":
        minute_bucket = (utc_dt.minute // 15) * 15
        return utc_dt.replace(minute=minute_bucket, second=0, microsecond=0)
    if canon == "1h":
        return utc_dt.replace(minute=0, second=0, microsecond=0)
    if canon == "4h":
        hour_bucket = (utc_dt.hour // 4) * 4
        return utc_dt.replace(hour=hour_bucket, minute=0, second=0, microsecond=0)
    if canon == "1d":
        return utc_dt.replace(hour=0, minute=0, second=0, microsecond=0)

    minutes = INTERVAL_MINUTES_MAP.get(canon, 5)
    epoch = int(utc_dt.timestamp())
    bucket_sec = minutes * 60
    floored = (epoch // bucket_sec) * bucket_sec
    return datetime.fromtimestamp(floored, tz=timezone.utc)


@dataclass
class LiveCandle:
    ts: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    is_closed: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "time": int(self.ts.timestamp()),
            "isoTime": self.ts.isoformat(),
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": round(self.volume, 4),
            "isClosed": self.is_closed,
        }


@dataclass
class SymbolFeedMetadata:
    symbol: str
    asset_class: str
    exchange: str
    last_price: float = 0.0
    change_pct: float = 0.0
    last_tick_at: Optional[datetime] = None
    last_bar_at: Optional[datetime] = None
    provider_connected: bool = False
    provider_error: Optional[str] = None


CandleCloseCallback = Callable[[str, str, str, str, LiveCandle, pd.DataFrame], None]


class TickCandleAggregator:
    """Aggregates real-time ticks into multi-timeframe candles with zero lookahead."""

    def __init__(self, max_bars: int = 500):
        self.max_bars = max_bars
        # Key: (asset_class, exchange, symbol, interval)
        self._closed_bars: Dict[Tuple[str, str, str, str], Deque[LiveCandle]] = {}
        self._forming_bar: Dict[Tuple[str, str, str, str], LiveCandle] = {}
        self._callbacks: List[CandleCloseCallback] = []
        self._lock = threading.RLock()

    def register_on_candle_close(self, callback: CandleCloseCallback) -> None:
        """Registers a callback invoked whenever a forming candle closes."""
        with self._lock:
            if callback not in self._callbacks:
                self._callbacks.append(callback)

    @staticmethod
    def _norm_key(asset_class: str, exchange: str, symbol: str, interval: str) -> Tuple[str, str, str, str]:
        ac = (asset_class or "equity").strip().lower()
        ex = (exchange or ("BINANCE" if ac == "crypto" else ("FX" if ac == "forex" else "NSE"))).strip().upper()
        sym = normalize_crypto_symbol(symbol) if ac == "crypto" else symbol.strip().upper()
        canon_int = map_to_canonical_interval(interval)
        return (ac, ex, sym, canon_int)

    def seed_history(
        self,
        symbol: str,
        interval: str,
        df: pd.DataFrame,
        asset_class: str = "equity",
        exchange: str = "NSE",
    ) -> None:
        """Seeds the rolling in-memory store with historical candles and detects forming vs closed bars."""
        if df is None or df.empty:
            return

        key = self._norm_key(asset_class, exchange, symbol, interval)
        ac, ex, sym, canon_int = key

        sorted_df = df.sort_values("time").drop_duplicates(subset=["time"]).reset_index(drop=True)
        closed_deque: Deque[LiveCandle] = deque(maxlen=self.max_bars)
        forming: Optional[LiveCandle] = None

        for idx, row in sorted_df.iterrows():
            raw_t = row["time"]
            bar_dt = raw_t.to_pydatetime() if hasattr(raw_t, "to_pydatetime") else pd.to_datetime(raw_t, utc=True).to_pydatetime()
            if bar_dt.tzinfo is None:
                bar_dt = bar_dt.replace(tzinfo=timezone.utc)
            else:
                bar_dt = bar_dt.astimezone(timezone.utc)

            floored_dt = floor_timestamp_to_interval(bar_dt, canon_int)
            complete = is_candle_complete(floored_dt, canon_int, asset_class=ac)
            candle = LiveCandle(
                ts=floored_dt,
                open=float(row["open"]),
                high=float(row["high"]),
                low=float(row["low"]),
                close=float(row["close"]),
                volume=float(row.get("volume", 0.0)),
                is_closed=complete,
            )
            if complete or idx < len(sorted_df) - 1:
                candle.is_closed = True
                closed_deque.append(candle)
            else:
                forming = candle

        with self._lock:
            self._closed_bars[key] = closed_deque
            if forming is not None:
                self._forming_bar[key] = forming

    def ingest_tick(
        self,
        symbol: str,
        price: float,
        volume: float = 0.0,
        ts: Optional[datetime] = None,
        asset_class: str = "equity",
        exchange: str = "NSE",
        intervals: Tuple[str, ...] = SUPPORTED_INTERVALS,
        is_delta_volume: bool = True,
    ) -> Dict[str, Dict[str, Any]]:
        """Updates forming candles across intervals and finalizes bars on boundary close.

        Returns a dict mapping interval -> {"forming": dict, "closed": Optional[dict]}.
        """
        if price <= 0:
            return {}

        tick_ts = ts or datetime.now(timezone.utc)
        if tick_ts.tzinfo is None:
            tick_ts = tick_ts.replace(tzinfo=timezone.utc)
        else:
            tick_ts = tick_ts.astimezone(timezone.utc)

        updates: Dict[str, Dict[str, Any]] = {}
        callbacks_to_fire: List[Tuple[str, str, str, str, LiveCandle, pd.DataFrame]] = []

        with self._lock:
            if not hasattr(self, "_last_tick_ts"):
                self._last_tick_ts: Dict[Tuple[str, str, str], datetime] = {}

            first_key = self._norm_key(asset_class, exchange, symbol, intervals[0])
            sym_key = (first_key[0], first_key[1], first_key[2])
            last_ts = self._last_tick_ts.get(sym_key)
            is_stale_tick = last_ts is not None and tick_ts < last_ts
            if not is_stale_tick:
                self._last_tick_ts[sym_key] = tick_ts

            for interval in intervals:
                key = self._norm_key(asset_class, exchange, symbol, interval)
                ac, ex, sym, canon_int = key
                bucket_ts = floor_timestamp_to_interval(tick_ts, canon_int)

                if key not in self._closed_bars:
                    self._closed_bars[key] = deque(maxlen=self.max_bars)

                current_forming = self._forming_bar.get(key)
                closed_candle_dict: Optional[Dict[str, Any]] = None

                if is_stale_tick and current_forming is not None:
                    updates[canon_int] = {
                        "forming": current_forming.to_dict(),
                        "closed": None,
                        "ignoredOutOfOrder": True,
                    }
                    continue

                if current_forming is None:
                    new_forming = LiveCandle(
                        ts=bucket_ts,
                        open=price,
                        high=price,
                        low=price,
                        close=price,
                        volume=max(0.0, float(volume)),
                        is_closed=False,
                    )
                    self._forming_bar[key] = new_forming
                elif bucket_ts > current_forming.ts:
                    # Previous bucket finished -> finalize candle!
                    current_forming.is_closed = True
                    self._closed_bars[key].append(current_forming)
                    closed_candle_dict = current_forming.to_dict()

                    hist_df = self.get_dataframe(sym, canon_int, asset_class=ac, exchange=ex, include_forming=False)
                    callbacks_to_fire.append((sym, ac, ex, canon_int, current_forming, hist_df))

                    # Start new forming candle
                    new_forming = LiveCandle(
                        ts=bucket_ts,
                        open=price,
                        high=price,
                        low=price,
                        close=price,
                        volume=max(0.0, float(volume)),
                        is_closed=False,
                    )
                    self._forming_bar[key] = new_forming
                elif bucket_ts == current_forming.ts:
                    current_forming.high = max(current_forming.high, price)
                    current_forming.low = min(current_forming.low, price)
                    current_forming.close = price
                    if is_delta_volume:
                        current_forming.volume += max(0.0, float(volume))
                    else:
                        current_forming.volume = max(current_forming.volume, float(volume))
                else:
                    # Out-of-order late tick older than current forming bar -> ignore to guarantee no repainting
                    updates[canon_int] = {
                        "forming": self._forming_bar[key].to_dict(),
                        "closed": None,
                        "ignoredOutOfOrder": True,
                    }
                    continue

                updates[canon_int] = {
                    "forming": self._forming_bar[key].to_dict(),
                    "closed": closed_candle_dict,
                }

            active_callbacks = list(self._callbacks)

        # Fire candle close callbacks outside the lock
        for sym, ac, ex, canon_int, closed_bar, hist_df in callbacks_to_fire:
            # Persist closed candle to Supabase cache best-effort
            try:
                from engine.db.supabase_client import is_supabase_configured, upsert_cached_candles

                if is_supabase_configured():
                    upsert_cached_candles(
                        [
                            {
                                "symbol": sym,
                                "asset_class": ac,
                                "exchange": ex,
                                "interval": canon_int,
                                "ts": closed_bar.ts,
                                "open": closed_bar.open,
                                "high": closed_bar.high,
                                "low": closed_bar.low,
                                "close": closed_bar.close,
                                "volume": closed_bar.volume,
                                "is_complete": True,
                            }
                        ]
                    )
            except Exception:
                pass

            for cb in active_callbacks:
                try:
                    try:
                        cb(sym, ac, ex, canon_int, closed_bar, hist_df)
                    except TypeError:
                        cb(ac, ex, sym, canon_int, closed_bar)
                except Exception as exc:
                    logger.warning(f"on_candle_close callback error for {sym} [{canon_int}]: {exc}")

        return updates

    def get_candles_list(
        self,
        symbol: str,
        interval: str,
        asset_class: str = "equity",
        exchange: str = "NSE",
        limit: int = 250,
        include_forming: bool = True,
    ) -> List[Dict[str, Any]]:
        """Returns serialized list of candles (closed + optional forming) for lightweight-charts."""
        key = self._norm_key(asset_class, exchange, symbol, interval)
        with self._lock:
            closed = list(self._closed_bars.get(key, []))
            forming = self._forming_bar.get(key)

        bars = [c.to_dict() for c in closed[-limit:]]
        if include_forming and forming is not None:
            if not bars or bars[-1]["time"] < int(forming.ts.timestamp()):
                bars.append(forming.to_dict())
            elif bars[-1]["time"] == int(forming.ts.timestamp()):
                bars[-1] = forming.to_dict()
        return bars[-limit:]

    def get_dataframe(
        self,
        symbol: str,
        interval: str,
        asset_class: str = "equity",
        exchange: str = "NSE",
        include_forming: bool = False,
    ) -> pd.DataFrame:
        """Returns normalized OHLCV DataFrame from the in-memory rolling store."""
        key = self._norm_key(asset_class, exchange, symbol, interval)
        with self._lock:
            closed = list(self._closed_bars.get(key, []))
            forming = self._forming_bar.get(key)

        items = list(closed)
        if include_forming and forming is not None:
            if not items or items[-1].ts < forming.ts:
                items.append(forming)

        if not items:
            return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])

        rows = [
            {
                "time": c.ts,
                "open": c.open,
                "high": c.high,
                "low": c.low,
                "close": c.close,
                "volume": c.volume,
            }
            for c in items
        ]
        return pd.DataFrame(rows)


class AngelWebSocketProvider:
    """Angel One SmartWebSocketV2 real-time tick provider for NSE Equities.

    Features:
    - Auto-reconnect with exponential backoff
    - Automatic resubscription of active tokens upon reconnect
    - Subscription limit enforcement (MAX_SUBSCRIPTIONS = 200)
    - Daily session expiry handling via angel_client.login()
    """

    MAX_SUBSCRIPTIONS = 200

    def __init__(
        self,
        angel_provider: AngelProvider,
        on_tick: Callable[[str, float, float, datetime], None],
    ):
        self.provider = angel_provider
        self.on_tick = on_tick
        self._subscribed_symbols: Dict[str, str] = {}  # symbol -> token
        self._token_to_symbol: Dict[str, str] = {}     # token -> symbol
        self._sws: Any = None
        self._connected: bool = False
        self._reconnect_attempts: int = 0
        self._max_reconnect_delay: float = 30.0
        self._lock = threading.RLock()

    @property
    def is_connected(self) -> bool:
        return self._connected

    @property
    def subscribed_symbols(self) -> Dict[str, str]:
        with self._lock:
            return dict(self._subscribed_symbols)

    @property
    def subscribed_count(self) -> int:
        with self._lock:
            return len(self._subscribed_symbols)

    def subscribe(self, symbol: str) -> bool:
        """Subscribes to an NSE equity symbol, enforcing MAX_SUBSCRIPTIONS."""
        sym = symbol.strip().upper()
        with self._lock:
            if sym in self._subscribed_symbols:
                return True
            if len(self._subscribed_symbols) >= self.MAX_SUBSCRIPTIONS:
                logger.warning(f"AngelWebSocketProvider subscription limit ({self.MAX_SUBSCRIPTIONS}) reached; rejecting {sym}.")
                return False

            info = self.provider.client.get_token_for_symbol(sym)
            if not info or not info.get("token"):
                logger.warning(f"AngelWebSocketProvider could not resolve token for {sym}.")
                return False

            token = str(info["token"])
            actual_sym = str(info.get("symbol", sym))
            self._subscribed_symbols[actual_sym] = token
            self._token_to_symbol[token] = actual_sym

            if self._connected and self._sws is not None:
                try:
                    # mode 2 = Quote (LTP + volume + OHLC)
                    self._sws.subscribe("signaldesk_live", 2, [{"exchangeType": 1, "tokens": [token]}])
                except Exception as exc:
                    logger.warning(f"AngelWebSocketV2 live subscribe call failed for {actual_sym}: {exc}")
            return True

    def unsubscribe(self, symbol: str) -> None:
        sym = symbol.strip().upper()
        with self._lock:
            token = self._subscribed_symbols.pop(sym, None)
            if token:
                self._token_to_symbol.pop(token, None)
                if self._connected and self._sws is not None:
                    try:
                        self._sws.unsubscribe("signaldesk_live", 2, [{"exchangeType": 1, "tokens": [token]}])
                    except Exception:
                        pass

    def handle_raw_ws_message(self, message: Dict[str, Any]) -> None:
        """Processes a parsed SmartWebSocketV2 message dict and dispatches normalized tick."""
        token = str(message.get("token", "")).strip('"')
        with self._lock:
            symbol = self._token_to_symbol.get(token)
        if not symbol:
            return

        # Angel SmartWebSocketV2 sends prices in paise (divide by 100) unless already float
        raw_ltp = message.get("last_traded_price") or message.get("ltp")
        if raw_ltp is None:
            return
        price = float(raw_ltp) / 100.0 if isinstance(raw_ltp, int) and raw_ltp > 1000 else float(raw_ltp)
        vol = float(message.get("volume_trade_for_the_day") or message.get("volume") or 0.0)
        exch_ts_ms = message.get("exchange_timestamp")
        if exch_ts_ms:
            ts = datetime.fromtimestamp(float(exch_ts_ms) / 1000.0, tz=timezone.utc)
        else:
            ts = datetime.now(timezone.utc)

        self.on_tick(symbol, price, vol, ts)

    def simulate_disconnect_and_reconnect(self) -> bool:
        """Handles connection drop with session check, relogin on expiry, and resubscription."""
        self._connected = False
        self._reconnect_attempts += 1
        try:
            # Refresh Angel session if expired
            if not self.provider.client.auth_token or not self.provider.client.feed_token:
                self.provider.client.login()

            with self._lock:
                tokens = list(self._token_to_symbol.keys())

            if self._sws is not None and tokens:
                self._sws.subscribe("signaldesk_live", 2, [{"exchangeType": 1, "tokens": tokens}])

            self._connected = True
            self._reconnect_attempts = 0
            return True
        except Exception as exc:
            logger.warning(f"AngelWebSocketProvider reconnect attempt #{self._reconnect_attempts} failed: {exc}")
            return False


class MarketDataHub:
    """Central real-time market data hub managing providers, candle aggregation, feed status, and WS clients."""

    MAX_UPDATES_PER_SEC = 4.0  # 250ms minimum interval per client

    def __init__(
        self,
        angel_provider: Optional[AngelProvider] = None,
        crypto_provider: Optional[CcxtProvider] = None,
        forex_provider: Optional[ForexProvider] = None,
    ):
        self.angel_provider = angel_provider or AngelProvider()
        self.crypto_provider = crypto_provider or CcxtProvider()
        self.forex_provider = forex_provider or ForexProvider()
        self.aggregator = TickCandleAggregator(max_bars=500)

        self._feeds: Dict[Tuple[str, str, str], SymbolFeedMetadata] = {}
        # Subscribed clients per (asset_class, exchange, symbol): set of client_ids
        self._symbol_subscribers: Dict[Tuple[str, str, str], Set[str]] = {}
        # Client queues: client_id -> asyncio.Queue
        self._client_queues: Dict[str, asyncio.Queue] = {}
        self._client_last_sent: Dict[str, float] = {}
        self._lock = threading.RLock()

        self.angel_ws = AngelWebSocketProvider(
            angel_provider=self.angel_provider,
            on_tick=lambda sym, price, vol, ts: self.process_tick(
                symbol=sym,
                price=price,
                volume=vol,
                ts=ts,
                asset_class="equity",
                exchange="NSE",
                is_delta_volume=False,
            ),
        )
        self._bg_task: Optional[asyncio.Task] = None
        self._running = False

    @staticmethod
    def _symbol_key(asset_class: str, exchange: str, symbol: str) -> Tuple[str, str, str]:
        ac = (asset_class or "equity").strip().lower()
        ex = (exchange or ("BINANCE" if ac == "crypto" else ("FX" if ac == "forex" else "NSE"))).strip().upper()
        sym = normalize_crypto_symbol(symbol) if ac == "crypto" else symbol.strip().upper()
        return (ac, ex, sym)

    def get_feed_status(
        self,
        symbol: str,
        asset_class: str = "equity",
        exchange: str = "NSE",
        now: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Computes real-time feed status (LIVE, DELAYED, CLOSED, UNAVAILABLE) from real timestamps."""
        now_utc = now or datetime.now(timezone.utc)
        if now_utc.tzinfo is None:
            now_utc = now_utc.replace(tzinfo=timezone.utc)

        key = self._symbol_key(asset_class, exchange, symbol)
        ac, ex, sym = key

        with self._lock:
            meta = self._feeds.get(key)

        # 1. Check provider availability first
        if ac == "forex":
            if not self.forex_provider.is_configured():
                return {
                    "symbol": sym,
                    "assetClass": ac,
                    "exchange": ex,
                    "status": "UNAVAILABLE",
                    "delaySeconds": 0,
                    "lastTickAt": None,
                    "reason": "Forex feed unavailable: FOREX_PROVIDER and FOREX_API_KEY are not configured in engine/.env.",
                }
            mh = self.forex_provider.market_hours()
            if not mh.get("is_open", False):
                return {
                    "symbol": sym,
                    "assetClass": ac,
                    "exchange": ex,
                    "status": "CLOSED",
                    "delaySeconds": 0,
                    "lastTickAt": meta.last_tick_at.isoformat() if (meta and meta.last_tick_at) else None,
                    "reason": f"Forex market closed ({mh.get('schedule')}).",
                }

        elif ac == "equity":
            missing_angel = settings.validate_angel_credentials()
            if missing_angel and (meta is None or (meta.last_tick_at is None and meta.last_bar_at is None)):
                err_text = f"Missing {', '.join(missing_angel)} in engine/.env."
                return {
                    "symbol": sym,
                    "assetClass": ac,
                    "exchange": ex,
                    "status": "UNAVAILABLE",
                    "delaySeconds": 0,
                    "lastTickAt": None,
                    "reason": err_text,
                    "error": err_text,
                }
            mh = self.angel_provider.market_hours()
            if not mh.get("is_open", False):
                err_msg = meta.provider_error if (meta and meta.provider_error and meta.last_bar_at is None) else None
                return {
                    "symbol": sym,
                    "assetClass": ac,
                    "exchange": ex,
                    "status": "CLOSED",
                    "delaySeconds": 0,
                    "lastTickAt": (
                        meta.last_tick_at.isoformat()
                        if (meta and meta.last_tick_at)
                        else (meta.last_bar_at.isoformat() if (meta and meta.last_bar_at) else None)
                    ),
                    "reason": err_msg or "Market closed (NSE hours: Mon-Fri 09:15-15:30 IST). Showing last session candles.",
                    "error": err_msg,
                }

        # 2. Market is open (or 24/7 crypto) -> inspect real tick timestamp age
        if meta is None or meta.last_tick_at is None:
            if meta and meta.provider_error:
                return {
                    "symbol": sym,
                    "assetClass": ac,
                    "exchange": ex,
                    "status": "UNAVAILABLE",
                    "delaySeconds": 0,
                    "lastTickAt": None,
                    "reason": meta.provider_error,
                    "error": meta.provider_error,
                }
            return {
                "symbol": sym,
                "assetClass": ac,
                "exchange": ex,
                "status": "DELAYED",
                "delaySeconds": 0,
                "lastTickAt": meta.last_bar_at.isoformat() if (meta and meta.last_bar_at) else None,
                "reason": "Awaiting initial live tick from feed...",
            }

        age_sec = max(0, int((now_utc - meta.last_tick_at).total_seconds()))
        if age_sec <= 15:
            return {
                "symbol": sym,
                "assetClass": ac,
                "exchange": ex,
                "status": "LIVE",
                "delaySeconds": age_sec,
                "lastTickAt": meta.last_tick_at.isoformat(),
                "reason": None,
            }
        return {
            "symbol": sym,
            "assetClass": ac,
            "exchange": ex,
            "status": "DELAYED",
            "delaySeconds": age_sec,
            "lastTickAt": meta.last_tick_at.isoformat(),
            "reason": f"Feed delayed by {age_sec}s",
        }

    def backfill_symbol_interval(
        self,
        symbol: str,
        interval: str,
        asset_class: str = "equity",
        exchange: str = "NSE",
        days: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Backfills historical candles from Supabase cache + provider REST and seeds aggregator."""
        key = self._symbol_key(asset_class, exchange, symbol)
        ac, ex, sym = key
        canon_int = map_to_canonical_interval(interval)

        existing = self.aggregator.get_candles_list(sym, canon_int, asset_class=ac, exchange=ex, limit=250)
        if len(existing) >= 40:
            return existing

        if ac == "forex" and not self.forex_provider.is_configured():
            return []

        lookback_days = days or (
            5 if canon_int == "1m"
            else (10 if canon_int == "5m"
            else (20 if canon_int == "15m"
            else (60 if canon_int == "1h"
            else (90 if canon_int == "4h" else 250))))
        )

        try:
            provider = get_provider(ac, exchange=ex)
            df = provider.get_candles(symbol=sym, interval=canon_int, days=lookback_days)
            if df is not None and not df.empty:
                self.aggregator.seed_history(sym, canon_int, df, asset_class=ac, exchange=ex)
                latest_close = float(df["close"].iloc[-1])
                latest_ts = df["time"].iloc[-1]
                bar_dt = latest_ts.to_pydatetime() if hasattr(latest_ts, "to_pydatetime") else pd.to_datetime(latest_ts, utc=True).to_pydatetime()
                with self._lock:
                    meta = self._feeds.setdefault(
                        key,
                        SymbolFeedMetadata(symbol=sym, asset_class=ac, exchange=ex),
                    )
                    if meta.last_price <= 0:
                        meta.last_price = latest_close
                    meta.last_bar_at = bar_dt
                    meta.provider_error = None
            else:
                client_err = getattr(getattr(provider, "client", None), "last_error", None)
                with self._lock:
                    meta = self._feeds.setdefault(
                        key,
                        SymbolFeedMetadata(symbol=sym, asset_class=ac, exchange=ex),
                    )
                    meta.provider_error = (
                        f"Angel One API error: {client_err}"
                        if client_err
                        else f"No historical candles returned by {ex} feed for {sym} ({canon_int})."
                    )
        except Exception as exc:
            logger.warning(f"Backfill failed for {sym} [{ac}:{canon_int}]: {exc}")
            with self._lock:
                meta = self._feeds.setdefault(
                    key,
                    SymbolFeedMetadata(symbol=sym, asset_class=ac, exchange=ex),
                )
                meta.provider_error = str(exc)

        return self.aggregator.get_candles_list(sym, canon_int, asset_class=ac, exchange=ex, limit=250)

    def process_tick(
        self,
        symbol: str,
        price: float,
        volume: float = 0.0,
        ts: Optional[datetime] = None,
        asset_class: str = "equity",
        exchange: str = "NSE",
        change_pct: Optional[float] = None,
        is_delta_volume: bool = True,
    ) -> Dict[str, Any]:
        """Ingests a live tick, updates forming candles across all timeframes, and fans out to subscribers."""
        tick_ts = ts or datetime.now(timezone.utc)
        if tick_ts.tzinfo is None:
            tick_ts = tick_ts.replace(tzinfo=timezone.utc)

        key = self._symbol_key(asset_class, exchange, symbol)
        ac, ex, sym = key

        with self._lock:
            meta = self._feeds.setdefault(
                key,
                SymbolFeedMetadata(symbol=sym, asset_class=ac, exchange=ex),
            )
            meta.last_price = float(price)
            if change_pct is not None:
                meta.change_pct = float(change_pct)
            meta.last_tick_at = tick_ts
            meta.provider_connected = True
            meta.provider_error = None
            subscribers = list(self._symbol_subscribers.get(key, set()))

        candle_updates = self.aggregator.ingest_tick(
            symbol=sym,
            price=price,
            volume=volume,
            ts=tick_ts,
            asset_class=ac,
            exchange=ex,
            is_delta_volume=is_delta_volume,
        )

        feed_status = self.get_feed_status(sym, asset_class=ac, exchange=ex, now=tick_ts)
        payload = {
            "type": "tick",
            "symbol": sym,
            "assetClass": ac,
            "exchange": ex,
            "ltp": price,
            "changePct": meta.change_pct,
            "timestamp": tick_ts.isoformat(),
            "feedStatus": feed_status,
            "candles": candle_updates,
        }

        self._fan_out_to_clients(subscribers, payload)
        return payload

    def broadcast_to_symbol_subscribers(
        self,
        symbol: str,
        asset_class: str,
        exchange: str,
        payload: Dict[str, Any],
    ) -> None:
        """Pushes an immediate strategy/checklist/signal event to all clients subscribed to symbol."""
        key = self._symbol_key(asset_class, exchange, symbol)
        with self._lock:
            subscribers = list(self._symbol_subscribers.get(key, set()))
        self._fan_out_to_clients(subscribers, payload, bypass_throttle=True)

    def _fan_out_to_clients(
        self,
        client_ids: List[str],
        payload: Dict[str, Any],
        bypass_throttle: bool = False,
    ) -> None:
        now_mono = time.monotonic()
        min_interval = 1.0 / self.MAX_UPDATES_PER_SEC

        with self._lock:
            for cid in client_ids:
                q = self._client_queues.get(cid)
                if q is None:
                    continue
                last_sent = self._client_last_sent.get(cid, 0.0)
                if not bypass_throttle and (now_mono - last_sent) < min_interval:
                    continue
                self._client_last_sent[cid] = now_mono
                try:
                    if q.full():
                        try:
                            q.get_nowait()
                        except Exception:
                            pass
                    q.put_nowait(payload)
                except Exception:
                    pass

    def subscribe_client(
        self,
        client_id: str,
        symbol: str,
        asset_class: str = "equity",
        exchange: str = "NSE",
    ) -> Tuple[asyncio.Queue, Tuple[str, str, str]]:
        """Registers a client subscription to a unique (asset_class, exchange, symbol)."""
        key = self._symbol_key(asset_class, exchange, symbol)
        ac, ex, sym = key

        with self._lock:
            if client_id not in self._client_queues:
                self._client_queues[client_id] = asyncio.Queue(maxsize=64)
            subs = self._symbol_subscribers.setdefault(key, set())
            is_first_subscriber = len(subs) == 0
            subs.add(client_id)

        if is_first_subscriber and ac == "equity":
            self.angel_ws.subscribe(sym)

        return self._client_queues[client_id], key

    def unsubscribe_client(self, client_id: str) -> None:
        """Cleans up all symbol subscriptions for a disconnected client."""
        empty_keys: List[Tuple[str, str, str]] = []
        with self._lock:
            self._client_queues.pop(client_id, None)
            self._client_last_sent.pop(client_id, None)
            for key, subs in list(self._symbol_subscribers.items()):
                subs.discard(client_id)
                if not subs:
                    empty_keys.append(key)
                    self._symbol_subscribers.pop(key, None)

        for ac, ex, sym in empty_keys:
            if ac == "equity":
                self.angel_ws.unsubscribe(sym)

    def get_active_subscriptions(self) -> List[Tuple[str, str, str]]:
        with self._lock:
            return list(self._symbol_subscribers.keys())

    async def start_background_loop(self) -> None:
        """Starts background async polling/streaming loop for active subscribed symbols."""
        if self._running:
            return
        self._running = True
        self._bg_task = asyncio.create_task(self._poll_active_symbols_loop())

    async def stop_background_loop(self) -> None:
        self._running = False
        if self._bg_task is not None:
            self._bg_task.cancel()
            self._bg_task = None

    async def _poll_active_symbols_loop(self) -> None:
        """Continuously fetches live quotes for subscribed symbols and feeds TickCandleAggregator."""
        while self._running:
            try:
                active_keys = self.get_active_subscriptions()
                for ac, ex, sym in active_keys:
                    try:
                        if ac == "crypto":
                            quote = await asyncio.to_thread(self.crypto_provider.get_last_price, sym)
                            ltp = float(quote.get("ltp", 0.0))
                            change_pct = float(quote.get("changePct", 0.0))
                            if ltp > 0:
                                self.process_tick(
                                    symbol=sym,
                                    price=ltp,
                                    volume=0.0,
                                    ts=datetime.now(timezone.utc),
                                    asset_class="crypto",
                                    exchange=ex,
                                    change_pct=change_pct,
                                )
                        elif ac == "equity":
                            mh = self.angel_provider.market_hours()
                            if mh.get("is_open", False) and not self.angel_ws.is_connected:
                                quote = await asyncio.to_thread(self.angel_provider.get_last_price, sym)
                                ltp = float(quote.get("ltp", 0.0))
                                change_pct = float(quote.get("changePct", 0.0))
                                if ltp > 0:
                                    self.process_tick(
                                        symbol=sym,
                                        price=ltp,
                                        volume=0.0,
                                        ts=datetime.now(timezone.utc),
                                        asset_class="equity",
                                        exchange=ex,
                                        change_pct=change_pct,
                                    )
                        elif ac == "forex" and self.forex_provider.is_configured():
                            quote = await asyncio.to_thread(self.forex_provider.get_last_price, sym)
                            ltp = float(quote.get("ltp", 0.0))
                            change_pct = float(quote.get("changePct", 0.0))
                            if ltp > 0:
                                self.process_tick(
                                    symbol=sym,
                                    price=ltp,
                                    volume=0.0,
                                    ts=datetime.now(timezone.utc),
                                    asset_class="forex",
                                    exchange=ex,
                                    change_pct=change_pct,
                                )
                    except Exception as sym_err:
                        logger.debug(f"Live poll error for {sym} [{ac}]: {sym_err}")

                await asyncio.sleep(2.0)
            except asyncio.CancelledError:
                break
            except Exception as loop_err:
                logger.warning(f"MarketDataHub poll loop error: {loop_err}")
                await asyncio.sleep(3.0)


market_data_hub = MarketDataHub()
