"""Market Scanner for SignalDesk.

Aggregates all user watchlists across Firestore, groups them by unique
(assetClass, exchange, symbol), scans multi-timeframe SMC & volume confluences
(NSE market hours for equities, 24/7 for crypto), de-duplicates repeated alerts,
persists signals, and dispatches WhatsApp messages.
"""

from datetime import datetime, time, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional

import pytz

from engine.data.angel_client import (
    AngelClient,
    INTERVAL_FIVE_MINUTE,
    INTERVAL_ONE_HOUR,
    INTERVAL_ONE_DAY,
    INTERVAL_WEEKLY,
)
from engine.data.candle_cache import CandleCacheManager
from engine.data.config import settings
from engine.data import firebase_client
from engine.data.providers import (
    CcxtProvider,
    DataProvider,
    TRADE_TYPE_TIMEFRAMES,
    encode_symbol_doc_id,
    get_provider,
)
from engine.strategies.confluence import evaluate_htf_bias, scan_timeframe_setup
from engine.strategies.trade_builder import build_trade_signal, TradeSignal
from engine.notifier import get_notifier

logger = logging.getLogger("signaldesk.scanner")
IST = pytz.timezone("Asia/Kolkata")


class MarketScanner:
    """Orchestrates multi-asset market scans, confluence scoring, and alert distribution."""

    def __init__(
        self,
        angel_client: Optional[AngelClient] = None,
        crypto_provider: Optional[CcxtProvider] = None,
    ):
        self.angel = angel_client or AngelClient()
        self.crypto_provider = crypto_provider or CcxtProvider()
        self.cache_manager = CandleCacheManager(angel_client=self.angel)
        self.notifier = get_notifier()
        # De-duplication cache: maps alert_key -> timestamp
        self._recent_alerts: Dict[str, datetime] = {}
        # Cache of last written live prices to avoid redundant Firestore writes
        self._last_live_prices: Dict[str, float] = {}
        # Cache for loaded ML model (optional)
        self.ml_model = None
        self._load_ml_model_if_available()

    def _load_ml_model_if_available(self) -> None:
        """Attempts to load pre-trained ML filter model if present."""
        try:
            from engine.ml.model import load_trained_model
            self.ml_model = load_trained_model()
            if self.ml_model:
                logger.info("ML Filter Model loaded into MarketScanner pipeline.")
        except Exception:
            self.ml_model = None

    @staticmethod
    def is_nse_market_open() -> bool:
        """Checks if current time in IST falls within NSE trading hours (Mon-Fri 09:15-15:30)."""
        now_ist = datetime.now(IST)
        if now_ist.weekday() >= 5:
            return False

        market_start = time(9, 15)
        market_end = time(15, 30)
        return market_start <= now_ist.time() <= market_end

    def _is_duplicate(self, symbol: str, trade_type: str, side: str, entry: float) -> bool:
        """Ensures the exact same setup does not alert multiple times within 60 minutes."""
        now = datetime.now(timezone.utc)
        self._recent_alerts = {
            k: v for k, v in self._recent_alerts.items() if now - v < timedelta(minutes=60)
        }

        # Key rounded to nearest price cluster
        rounded_entry = round(entry / 5.0) * 5.0 if entry > 50 else round(entry, 1 if entry >= 1 else 4)
        key = f"{symbol}_{trade_type}_{side}_{rounded_entry}"

        if key in self._recent_alerts:
            return True

        self._recent_alerts[key] = now
        return False

    def scan_all_symbols(
        self,
        force_run: bool = False,
        scan_type: Optional[str] = None,
        asset_class_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Executes full scan across unique symbols from all watchlists.

        Args:
            force_run: Bypass NSE market hours check for equities.
            scan_type: 'INTRADAY', 'DELIVERY', 'SCALP', 'SWING', or None (all subscribed).
            asset_class_filter: Optional 'equity' or 'crypto' filter.
        """
        logger.info("Starting market scan cycle across user watchlists...")
        try:
            watchlists = firebase_client.get_all_watchlists()
        except Exception as exc:
            logger.error(f"Failed to load watchlists from Firestore: {exc}")
            return []

        if not watchlists:
            logger.info("No active watchlists found in Firestore.")
            return []

        nse_open = self.is_nse_market_open()
        dispatched_signals: List[Dict[str, Any]] = []

        for item in watchlists:
            symbol = item["symbol"]
            asset_class = str(item.get("assetClass") or ("crypto" if "/" in str(symbol) else "equity")).lower()
            exchange = str(item.get("exchange") or (self.crypto_provider.exchange_id.upper() if asset_class == "crypto" else "NSE")).upper()

            if asset_class_filter and asset_class != asset_class_filter.lower():
                continue

            # Equities only scan during NSE market hours unless force_run is True; Crypto scans 24/7
            if asset_class == "equity" and not force_run and not nse_open:
                continue

            trade_types: List[str] = item.get("tradeTypes", ["scalp", "intraday"] if asset_class == "crypto" else ["intraday"])
            subscribers: List[Dict[str, Any]] = item.get("subscribers", [])
            lower_types = [t.lower() for t in trade_types]

            if asset_class == "crypto":
                crypto_modes = [
                    ("SCALP", "scalp"),
                    ("INTRADAY", "intraday"),
                    ("SWING", "swing"),
                ]
                for mode_upper, mode_lower in crypto_modes:
                    if (scan_type in (None, mode_upper)) and (mode_lower in lower_types or "both" in lower_types or "all" in lower_types):
                        sig = self._scan_single_asset(
                            symbol=symbol,
                            trade_type=mode_upper,
                            asset_class="crypto",
                            exchange=exchange,
                        )
                        if sig:
                            self._distribute_signal(sig, subscribers, mode_lower)
                            dispatched_signals.append(sig.to_dict())
            else:
                # Equity pipelines: INTRADAY & DELIVERY
                if (scan_type in (None, "INTRADAY")) and ("intraday" in lower_types or "both" in lower_types):
                    sig = self._scan_single_stock(symbol, trade_type="INTRADAY")
                    if sig:
                        self._distribute_signal(sig, subscribers, "intraday")
                        dispatched_signals.append(sig.to_dict())

                if (scan_type in (None, "DELIVERY")) and ("delivery" in lower_types or "both" in lower_types):
                    sig = self._scan_single_stock(symbol, trade_type="DELIVERY")
                    if sig:
                        self._distribute_signal(sig, subscribers, "delivery")
                        dispatched_signals.append(sig.to_dict())

        logger.info(f"Scan cycle complete. Dispatched {len(dispatched_signals)} signals.")
        try:
            from engine.db.supabase_client import log_engine_event
            log_engine_event(
                "INFO",
                f"Scan cycle complete: {len(dispatched_signals)} signals dispatched across {len(watchlists)} symbols",
                {"dispatched_count": len(dispatched_signals), "symbols_count": len(watchlists)},
            )
        except Exception:
            pass
        return dispatched_signals

    def _scan_single_stock(self, symbol: str, trade_type: str) -> Optional[TradeSignal]:
        """Fetches candles and scans single NSE stock setup."""
        return self._scan_single_asset(
            symbol=symbol,
            trade_type=trade_type,
            asset_class="equity",
            exchange="NSE",
        )

    def _scan_single_asset(
        self,
        symbol: str,
        trade_type: str,
        asset_class: str = "equity",
        exchange: str = "NSE",
    ) -> Optional[TradeSignal]:
        """Fetches candles via provider/cache and evaluates SMC + Volume + Price Action setup."""
        try:
            tf_cfg = TRADE_TYPE_TIMEFRAMES.get(asset_class, {}).get(
                trade_type.upper(),
                TRADE_TYPE_TIMEFRAMES["equity"]["INTRADAY"],
            )
            entry_tf_name = tf_cfg["entry"]
            bias_tf_name = tf_cfg["bias"]
            entry_days = int(tf_cfg["entry_days"])
            bias_days = int(tf_cfg["bias_days"])

            if asset_class == "crypto":
                provider: DataProvider = (
                    self.crypto_provider
                    if self.crypto_provider.exchange_id.upper() == exchange.upper()
                    else get_provider("crypto", exchange=exchange.lower())
                )
                entry_df = self.cache_manager.get_candles_with_provider(
                    provider=provider,
                    symbol=symbol,
                    interval=entry_tf_name,
                    days=entry_days,
                    asset_class="crypto",
                    exchange=exchange,
                )
                htf_df = self.cache_manager.get_candles_with_provider(
                    provider=provider,
                    symbol=symbol,
                    interval=bias_tf_name,
                    days=bias_days,
                    asset_class="crypto",
                    exchange=exchange,
                )
            else:
                if trade_type == "INTRADAY":
                    entry_df = self.angel.get_candles(symbol, interval=INTERVAL_FIVE_MINUTE, days=entry_days)
                    htf_df = self.angel.get_candles(symbol, interval=INTERVAL_ONE_HOUR, days=bias_days)
                else:
                    entry_df = self.angel.get_candles(symbol, interval=INTERVAL_ONE_DAY, days=entry_days)
                    htf_df = self.angel.get_candles(symbol, interval=INTERVAL_WEEKLY, days=bias_days)

            if entry_df is None or entry_df.empty or len(entry_df) < 20:
                logger.debug(f"Insufficient candles for {symbol} [{asset_class}:{trade_type}]. Skipping.")
                return None

            htf_bias = evaluate_htf_bias(htf_df) if (htf_df is not None and not htf_df.empty) else "NEUTRAL"
            if htf_bias == "NEUTRAL":
                return None

            candidate = scan_timeframe_setup(
                symbol=symbol,
                entry_df=entry_df,
                htf_bias=htf_bias,
                trade_type=trade_type,  # type: ignore[arg-type]
                timeframes_meta={"entry": entry_tf_name, "bias": f"{bias_tf_name} ({htf_bias})"},
                asset_class=asset_class,
                exchange=exchange,
            )

            if not candidate:
                return None

            signal = build_trade_signal(candidate)
            if not signal:
                return None

            if self._is_duplicate(signal.symbol, signal.tradeType, signal.side, signal.entry):
                logger.debug(f"Setup for {symbol} [{trade_type}] matches recent alert. De-duplicating.")
                return None

            # ML Filter gate (if trained model available)
            if self.ml_model is not None:
                try:
                    from engine.ml.features import extract_single_setup_features
                    features = extract_single_setup_features(candidate, entry_df)
                    if hasattr(self.ml_model, "predict_win_probability"):
                        prob = float(self.ml_model.predict_win_probability(features))
                    else:
                        prob = float(self.ml_model.predict_proba([list(features.values())])[0][1])
                    if prob < settings.ml_threshold:
                        logger.info(
                            f"Signal {signal.symbol} filtered out by ML model (win prob {prob:.2f} < threshold {settings.ml_threshold:.2f})"
                        )
                        return None
                    logger.info(f"Signal {signal.symbol} passed ML filter (win prob {prob:.2f} >= {settings.ml_threshold:.2f})")
                except Exception as ml_err:
                    logger.warning(f"ML filter evaluation failed ({ml_err}), falling back to rule-only signal.")

            return signal

        except Exception as exc:
            logger.error(f"Error scanning setup for {symbol} [{asset_class}:{trade_type}]: {exc}")
            return None

    def _distribute_signal(
        self,
        signal: TradeSignal,
        subscribers: List[Dict[str, Any]],
        filter_type: str,
    ) -> None:
        """Persists signal to Firestore per subscriber and sends WhatsApp notifications."""
        sig_data = signal.to_dict()

        for sub in subscribers:
            uid = sub.get("uid")
            sub_types = [t.lower() for t in sub.get("tradeTypes", [])]

            if filter_type not in sub_types and "both" not in sub_types and "all" not in sub_types:
                continue

            user_signal = dict(sig_data)
            user_signal["uid"] = uid

            try:
                doc_id = firebase_client.write_signal(user_signal)
                logger.info(f"Signal written to Firestore for uid {uid[:6]}*** (Doc: {doc_id})")

                db = firebase_client.get_firestore_client()
                user_doc = db.collection("users").document(uid).get()
                whatsapp_num = ""
                if user_doc.exists:
                    whatsapp_num = user_doc.to_dict().get("whatsapp", "")

                if whatsapp_num:
                    self.notifier.send_signal_alert(user_signal, whatsapp_num)
                else:
                    logger.debug(f"No WhatsApp number registered for user {uid[:6]}***")

            except Exception as exc:
                logger.error(f"Failed to distribute signal to uid {uid}: {exc}")

    def update_live_prices(self, force_run: bool = False) -> None:
        """Fetches latest prices for all unique watchlist symbols and writes to livePrices/{symbolDocId}.

        Only writes to Firestore when `ltp` has actually changed, conserving Firestore write quota.
        Crypto prices are updated 24/7; equity prices are updated during NSE hours (or when force_run=True).
        """
        try:
            watchlists = firebase_client.get_all_watchlists()
        except Exception as exc:
            logger.error(f"Failed to load watchlists for live prices: {exc}")
            return

        if not watchlists:
            return

        nse_open = self.is_nse_market_open()
        now_iso = datetime.now(timezone.utc).isoformat()

        for item in watchlists:
            symbol = item.get("symbol")
            if not symbol:
                continue

            asset_class = str(item.get("assetClass") or ("crypto" if "/" in str(symbol) else "equity")).lower()
            exchange = str(item.get("exchange") or (self.crypto_provider.exchange_id.upper() if asset_class == "crypto" else "NSE")).upper()

            if asset_class == "equity" and not force_run and not nse_open:
                continue

            try:
                ltp: Optional[float] = None
                change_pct: float = 0.0

                if asset_class == "crypto":
                    provider = (
                        self.crypto_provider
                        if self.crypto_provider.exchange_id.upper() == exchange.upper()
                        else get_provider("crypto", exchange=exchange.lower())
                    )
                    quote = provider.get_last_price(symbol)
                    if quote and quote.get("ltp", 0) > 0:
                        ltp = float(quote["ltp"])
                        change_pct = float(quote.get("changePct", 0.0))
                else:
                    df = self.angel.get_candles(symbol, INTERVAL_FIVE_MINUTE, days=2)
                    if df is not None and not df.empty:
                        ltp = float(df["close"].iloc[-1])
                        prev_close = float(df["open"].iloc[0]) if len(df) > 1 else ltp
                        change_pct = round(((ltp - prev_close) / prev_close) * 100, 2) if prev_close > 0 else 0.0

                if ltp is None or ltp <= 0:
                    continue

                doc_id = encode_symbol_doc_id(symbol)
                decimals = 6 if ltp < 1.0 else (4 if ltp < 10.0 else 2)
                rounded_ltp = round(ltp, decimals)

                # Only write to Firestore if ltp changed from last write
                if self._last_live_prices.get(doc_id) == rounded_ltp:
                    continue

                self._last_live_prices[doc_id] = rounded_ltp
                firebase_client.write_live_price(
                    symbol=symbol,
                    ltp=rounded_ltp,
                    change_pct=change_pct,
                    updated_at=now_iso,
                    last_scan_at=now_iso,
                    asset_class=asset_class,
                    exchange=exchange,
                )
            except Exception as exc:
                logger.warning(f"Could not update live price for {symbol}: {exc}")


