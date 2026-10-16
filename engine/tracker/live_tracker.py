"""Live Signal Outcome Tracker for SignalDesk (Phase 1 Upgraded).

Continuously monitors active signals against live price candles:
- Tracks confirmed signals until TP, SL, or 15:15 IST (3:15 PM) mandatory square-off.
- Records exact gross PnL, net PnL, itemized statutory costs, gross R, and net R.
- Stores outcomes in Firestore 'signal_outcomes/{signal_id}' without altering the immutable signal record.
- SL-first rule: If SL and TP are both touched in the same candle, SL is counted first.
"""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd

from engine.backtest.costs import cost_model, CostBreakdown
from engine.backtest.engine import _is_past_square_off_time
from engine.data.angel_client import AngelClient, INTERVAL_FIVE_MINUTE
from engine.data.providers import CcxtProvider, get_provider
from engine.data import firebase_client
from engine.scheduler.scanner import MarketScanner

logger = logging.getLogger("signaldesk.tracker")


class SignalTracker:
    """Monitors open trading signals and executes automated TP / SL / 15:15 square-off resolution."""

    def __init__(
        self,
        angel_client: Optional[AngelClient] = None,
        crypto_provider: Optional[CcxtProvider] = None,
    ):
        self.angel = angel_client or AngelClient()
        self.crypto_provider = crypto_provider or CcxtProvider()

    def check_signal_against_candle(
        self,
        signal: Dict[str, Any],
        candle_high: float,
        candle_low: float,
        candle_close: Optional[float] = None,
        candle_time: Optional[Any] = None,
    ) -> Optional[Any]:
        """Evaluates whether an open signal reached TP, SL, or 15:15 square-off in this bar.

        Returns:
            (status, exit_price, exit_reason) or (status, exit_price) if candle_close/time omitted.
            None if still active.
        """
        side = signal.get("side", "BUY")
        sl = float(signal.get("sl", 0.0))
        tp = float(signal.get("tp", 0.0))
        trade_type = str(signal.get("tradeType") or "INTRADAY").upper()
        asset_class = str(signal.get("assetClass") or "equity").lower()
        legacy_mode = candle_close is None and candle_time is None

        # 1. 15:15 IST Mandatory Square-Off for NSE Intraday MIS
        if asset_class == "equity" and trade_type == "INTRADAY" and candle_time is not None:
            if _is_past_square_off_time(candle_time):
                sq_price = candle_close if candle_close is not None else candle_low
                return ("SQUARE_OFF_315", sq_price) if legacy_mode else ("SQUARE_OFF_315", sq_price, "INTRADAY_SQUARE_OFF_315")

        # 2. Check TP / SL with SL-first conflict priority
        if side == "BUY":
            hit_sl = candle_low <= sl
            hit_tp = candle_high >= tp

            if hit_sl:
                return ("SL HIT", sl) if legacy_mode else ("SL HIT", sl, "STOP_LOSS_HIT")
            elif hit_tp:
                return ("TP HIT", tp) if legacy_mode else ("TP HIT", tp, "TARGET_REACHED")

        else:  # SELL
            hit_sl = candle_high >= sl
            hit_tp = candle_low <= tp

            if hit_sl:
                return ("SL HIT", sl) if legacy_mode else ("SL HIT", sl, "STOP_LOSS_HIT")
            elif hit_tp:
                return ("TP HIT", tp) if legacy_mode else ("TP HIT", tp, "TARGET_REACHED")

        return None

    def run_tracking_cycle(self, force_equity: bool = False) -> List[Dict[str, Any]]:
        """Executes a single monitoring cycle across open signals and writes outcomes next to immutable signals."""
        logger.info("Executing signal tracking cycle...")
        try:
            open_signals = firebase_client.get_open_signals()
        except Exception as exc:
            logger.warning(f"Could not fetch open signals from Firestore: {exc}")
            return []

        if not open_signals:
            logger.debug("No open signals to monitor.")
            return []

        # Filter out signals that already have recorded outcomes in signal_outcomes
        pending_signals = []
        for s in open_signals:
            s_id = s.get("id")
            if not s_id:
                continue
            try:
                existing_outcome = firebase_client.get_signal_outcome(s_id)
            except Exception:
                existing_outcome = None
            if existing_outcome is None:
                pending_signals.append(s)

        if not pending_signals:
            logger.debug("All signals already have recorded outcomes.")
            return []

        logger.info(f"Monitoring {len(pending_signals)} active open signals...")
        nse_open = MarketScanner.is_nse_market_open()

        # Group by (assetClass, exchange, symbol)
        signals_by_group: Dict[Tuple[str, str, str], List[Dict[str, Any]]] = {}
        for s in pending_signals:
            sym = s.get("symbol")
            if not sym:
                continue
            asset_class = str(s.get("assetClass") or ("crypto" if "/" in str(sym) else "equity")).lower()
            exchange = str(s.get("exchange") or (self.crypto_provider.exchange_id.upper() if asset_class == "crypto" else "NSE")).upper()
            signals_by_group.setdefault((asset_class, exchange, sym), []).append(s)

        resolved_outcomes: List[Dict[str, Any]] = []

        for (asset_class, exchange, symbol), sig_list in signals_by_group.items():
            if asset_class == "equity" and not force_equity and not nse_open:
                continue

            try:
                now_utc = datetime.now(timezone.utc)
                if asset_class == "crypto":
                    provider = (
                        self.crypto_provider
                        if self.crypto_provider.exchange_id.upper() == exchange.upper()
                        else get_provider("crypto", exchange=exchange.lower())
                    )
                    df = provider.get_candles(
                        symbol=symbol,
                        interval="5m",
                        start=now_utc - timedelta(hours=6),
                        end=now_utc,
                    )
                else:
                    df = self.angel.get_candles(symbol, interval=INTERVAL_FIVE_MINUTE, days=2)

                if df is None or df.empty:
                    continue

                latest_bar = df.iloc[-1]
                high = float(latest_bar["high"])
                low = float(latest_bar["low"])
                close = float(latest_bar["close"])
                bar_time = latest_bar["time"]

                for sig in sig_list:
                    sig_id = sig.get("id")
                    res = self.check_signal_against_candle(
                        signal=sig,
                        candle_high=high,
                        candle_low=low,
                        candle_close=close,
                        candle_time=bar_time,
                    )

                    if res is not None:
                        status, exit_price, exit_reason = res
                        entry_price = float(sig.get("entry", close))
                        sl = float(sig.get("sl", 0.0))
                        side = sig.get("side", "BUY")
                        trade_type = sig.get("tradeType", "INTRADAY")
                        risk_per_unit = abs(entry_price - sl)
                        qty = float(sig.get("quantity", 0.0))
                        if qty <= 0:
                            qty = float(max(1, int(1000.0 / risk_per_unit))) if risk_per_unit > 0 else 1.0

                        # Calculate real statutory costs and R multiples
                        cost_breakdown: CostBreakdown = cost_model.calculate_costs(
                            entry_price=entry_price,
                            exit_price=exit_price,
                            quantity=qty,
                            side=side,
                            sl=sl,
                            asset_class=asset_class,
                        )

                        outcome_payload = {
                            "id": sig_id,
                            "signal_id": sig_id,
                            "symbol": symbol,
                            "asset_class": asset_class,
                            "assetClass": asset_class,
                            "exchange": exchange,
                            "trade_type": trade_type,
                            "tradeType": trade_type,
                            "side": side,
                            "status": status,
                            "exit_reason": exit_reason,
                            "exitReason": exit_reason,
                            "entry_price": entry_price,
                            "entry": entry_price,
                            "entry_price_executed": cost_breakdown.entry_price_executed,
                            "exit_price": exit_price,
                            "exitPrice": exit_price,
                            "exit_price_executed": cost_breakdown.exit_price_executed,
                            "sl": sl,
                            "tp": float(sig.get("tp", 0.0)),
                            "quantity": qty,
                            "gross_pnl": cost_breakdown.gross_pnl,
                            "net_pnl": cost_breakdown.net_pnl,
                            "gross_r": cost_breakdown.gross_r,
                            "net_r": cost_breakdown.net_r,
                            "total_costs": cost_breakdown.total_costs,
                            "costs": cost_breakdown.to_dict(),
                            "closed_at": now_utc.isoformat(),
                            "closedAt": now_utc.isoformat(),
                            "recorded_at": now_utc.isoformat(),
                        }

                        # 1. Store outcome in Firestore next to the immutable signal record
                        try:
                            firebase_client.write_signal_outcome(sig_id, outcome_payload)
                        except Exception as w_err:
                            logger.debug(f"Firestore write_signal_outcome notice: {w_err}")

                        # 2. Mirror outcome to Supabase analytics
                        try:
                            from engine.db.supabase_client import upsert_signal_outcome
                            upsert_signal_outcome(outcome_payload)
                        except Exception as sb_err:
                            logger.debug(f"Could not mirror signal outcome to Supabase: {sb_err}")

                        logger.info(
                            f"Signal {sig_id} for {symbol} resolved: {status} ({exit_reason}) | Net R: {cost_breakdown.net_r:+.2f}R"
                        )
                        resolved_outcomes.append(outcome_payload)

            except Exception as exc:
                logger.error(f"Error checking tracking for {symbol}: {exc}")

        return resolved_outcomes
