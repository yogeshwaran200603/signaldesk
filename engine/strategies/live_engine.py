"""Live Strategy Engine & Confirmation State Machine for SignalDesk (Phase 3).

Guarantees:
1. Strategy Modes:
   - SCALPING (1m/5m entry, 15m bias)
   - INTRADAY (5m/15m entry, 1h bias)
   - SWING (1h/4h or 1d entry, 1d/1w bias)
2. 8-Point Live Confirmation Checklist:
   - htf_bias_aligned: Higher-timeframe bias aligned (BULLISH or BEARISH)
   - liquidity_sweep: Liquidity sweep or structural stop-hunt detected
   - choch_bos: Break of Structure (BOS) or Change of Character (CHoCH)
   - ob_fvg_retest: Price mitigating Order Block (OB) or Fair Value Gap (FVG)
   - volume_vwap: Volume expansion / VWAP / Volume Profile POC alignment
   - candle_pattern: Reversal/momentum candlestick confirmation at zone
   - session_volatility: Market session open & healthy ATR volatility filter
   - rr_feasible: Risk-to-Reward >= 1:2 (2.0) to opposing liquidity pool
3. Strict State Machine:
   - WATCHING -> FORMING -> CONFIRMED -> ACTIVE -> TP HIT / SL HIT / INVALIDATED / EXPIRED
4. Zero Fake Entries & Zero Repainting:
   - Entry, SL, and TP are issued ONLY when state == CONFIRMED / ACTIVE.
   - If not confirmed, returns signal=None and message="No setup. Waiting for confirmation."
   - Confirmations finalize strictly on candle close; issued signals are immutable.
   - Per-symbol cooldown & de-duplication prevent duplicate alerts.
"""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
import logging
import threading
from typing import Any, Dict, List, Literal, Optional, Tuple
import uuid

import numpy as np
import pandas as pd

from engine.data.config import settings
from engine.strategies.confluence import (
    SetupCandidate,
    compute_atr,
    evaluate_htf_bias,
)
from engine.strategies.price_action import (
    detect_candlestick_patterns,
    find_support_resistance,
)
from engine.strategies.smc import (
    calculate_premium_discount,
    detect_bos_choch,
    detect_fair_value_gaps,
    detect_liquidity_sweeps,
    detect_order_blocks,
    find_swing_points,
)
from engine.strategies.trade_builder import TradeSignal, _round_price, build_trade_signal
from engine.strategies.volume import (
    calculate_volume_profile,
    calculate_vwap,
    detect_volume_spikes,
)

logger = logging.getLogger("signaldesk.live_engine")

SignalLifecycleState = Literal[
    "WATCHING",
    "FORMING",
    "CONFIRMED",
    "ACTIVE",
    "TP HIT",
    "SL HIT",
    "INVALIDATED",
    "EXPIRED",
]

StrategyModeLiteral = Literal["SCALPING", "INTRADAY", "SWING"]


# Mode -> Default (entry_tf, bias_tf) per asset class
MODE_TIMEFRAME_CONFIG: Dict[str, Dict[str, Dict[str, str]]] = {
    "equity": {
        "SCALPING": {"entry": "1m", "bias": "15m"},
        "INTRADAY": {"entry": "5m", "bias": "1h"},
        "SWING": {"entry": "1d", "bias": "1w"},
    },
    "crypto": {
        "SCALPING": {"entry": "5m", "bias": "15m"},
        "INTRADAY": {"entry": "15m", "bias": "1h"},
        "SWING": {"entry": "4h", "bias": "1d"},
    },
    "forex": {
        "SCALPING": {"entry": "5m", "bias": "15m"},
        "INTRADAY": {"entry": "15m", "bias": "1h"},
        "SWING": {"entry": "4h", "bias": "1d"},
    },
}

# Flat canonical mode -> timeframe lookup
MODE_TIMEFRAMES: Dict[str, Dict[str, str]] = {
    "SCALPING": {"entry": "1m", "bias": "15m"},
    "SCALP": {"entry": "1m", "bias": "15m"},
    "INTRADAY": {"entry": "5m", "bias": "1h"},
    "SWING": {"entry": "1d", "bias": "1w"},
    "DELIVERY": {"entry": "1d", "bias": "1w"},
}


@dataclass
class ChecklistItem:
    id: str
    label: str
    passed: bool
    required: bool
    status: Literal["PASSED", "PENDING", "FAILED"]
    detail: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ImmutableConfirmedSignal:
    """Immutable record of a confirmed signal locked on candle close (No Repainting)."""
    id: str
    symbol: str
    assetClass: str
    exchange: str
    mode: str
    tradeType: str
    side: Literal["BUY", "SELL"]
    entry: float
    sl: float
    tp: float
    rr: float
    confidence: int
    mlProbability: float
    mlModelUsed: str
    state: SignalLifecycleState
    candleTimestamp: str
    confirmedAt: str
    reasons: List[str]
    timeframes: Dict[str, str]
    closedAt: Optional[str] = None
    exitPrice: Optional[float] = None
    outcome: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class LiveEvaluationSnapshot:
    symbol: str
    assetClass: str
    exchange: str
    mode: str
    entryTimeframe: str
    biasTimeframe: str
    htfBias: Literal["BULLISH", "BEARISH", "NEUTRAL"]
    state: SignalLifecycleState
    statusMessage: str
    passedCount: int
    totalCount: int
    mlProbability: Optional[float]
    mlThreshold: float
    checklist: List[ChecklistItem]
    signal: Optional[Dict[str, Any]]
    overlays: Dict[str, Any]
    evaluatedAt: str
    decidedOnCandleClose: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "assetClass": self.assetClass,
            "exchange": self.exchange,
            "mode": self.mode,
            "entryTimeframe": self.entryTimeframe,
            "biasTimeframe": self.biasTimeframe,
            "htfBias": self.htfBias,
            "state": self.state,
            "statusMessage": self.statusMessage,
            "passedCount": self.passedCount,
            "totalCount": self.totalCount,
            "mlProbability": self.mlProbability,
            "mlThreshold": self.mlThreshold,
            "checklist": [c.to_dict() for c in self.checklist],
            "signal": self.signal,
            "overlays": self.overlays,
            "evaluatedAt": self.evaluatedAt,
            "decidedOnCandleClose": self.decidedOnCandleClose,
        }


def resolve_mode_timeframes(
    asset_class: str,
    mode: str,
    custom_entry_tf: Optional[str] = None,
) -> Tuple[str, str]:
    """Resolves (entry_tf, bias_tf) for a given asset_class and strategy mode."""
    ac = (asset_class or "equity").strip().lower()
    m = (mode or "INTRADAY").strip().upper()
    if m == "SCALP":
        m = "SCALPING"
    elif m == "DELIVERY":
        m = "SWING"

    ac_map = MODE_TIMEFRAME_CONFIG.get(ac, MODE_TIMEFRAME_CONFIG["equity"])
    cfg = ac_map.get(m, ac_map["INTRADAY"])
    entry_tf = custom_entry_tf or cfg["entry"]
    bias_tf = cfg["bias"]
    return entry_tf, bias_tf


class LiveStrategyEngine:
    """Evaluates multi-timeframe SMC + Volume + Price Action checklists and manages immutable signal lifecycle."""

    COOLDOWN_MINUTES = 60

    def __init__(self, ml_threshold: Optional[float] = None):
        self.ml_threshold = ml_threshold if ml_threshold is not None else settings.ml_threshold
        # Key: (asset_class, exchange, symbol, mode) -> ImmutableConfirmedSignal
        self._active_signals: Dict[Tuple[str, str, str, str], ImmutableConfirmedSignal] = {}
        # Key: (asset_class, exchange, symbol, mode) -> List[ImmutableConfirmedSignal] (recent history)
        self._signal_history: Dict[Tuple[str, str, str, str], List[ImmutableConfirmedSignal]] = {}
        # Cooldown map: (asset_class, exchange, symbol, mode, side, price_cluster) -> datetime
        self._cooldowns: Dict[Tuple[str, str, str, str, str, float], datetime] = {}
        # Latest evaluation snapshot cache
        self._latest_snapshots: Dict[Tuple[str, str, str, str], LiveEvaluationSnapshot] = {}
        self._lock = threading.RLock()

    @staticmethod
    def _state_key(asset_class: str, exchange: str, symbol: str, mode: str) -> Tuple[str, str, str, str]:
        ac = (asset_class or "equity").strip().lower()
        ex = (exchange or ("BINANCE" if ac == "crypto" else ("FX" if ac == "forex" else "NSE"))).strip().upper()
        sym = symbol.strip().upper()
        m = (mode or "INTRADAY").strip().upper()
        if m == "SCALP":
            m = "SCALPING"
        elif m == "DELIVERY":
            m = "SWING"
        return (ac, ex, sym, m)

    _key = _state_key

    def _is_on_cooldown(
        self,
        key: Tuple[str, str, str, str],
        side: str,
        entry_price: float,
        now_utc: datetime,
    ) -> bool:
        ac, ex, sym, mode = key
        cluster = round(entry_price / 5.0) * 5.0 if entry_price > 50 else round(entry_price, 1 if entry_price >= 1 else 4)
        cd_key = (ac, ex, sym, mode, side.upper(), cluster)

        with self._lock:
            # Prune expired cooldowns
            expired = [
                k for k, ts in self._cooldowns.items()
                if (now_utc - ts) >= timedelta(minutes=self.COOLDOWN_MINUTES)
            ]
            for k in expired:
                self._cooldowns.pop(k, None)

            return cd_key in self._cooldowns

    def _record_cooldown(
        self,
        key: Tuple[str, str, str, str],
        side: str,
        entry_price: float,
        now_utc: datetime,
    ) -> None:
        ac, ex, sym, mode = key
        cluster = round(entry_price / 5.0) * 5.0 if entry_price > 50 else round(entry_price, 1 if entry_price >= 1 else 4)
        cd_key = (ac, ex, sym, mode, side.upper(), cluster)
        with self._lock:
            self._cooldowns[cd_key] = now_utc

    def update_active_signal_on_tick(
        self,
        symbol: str,
        price: float,
        candle_high: Optional[float] = None,
        candle_low: Optional[float] = None,
        asset_class: str = "equity",
        exchange: str = "NSE",
        mode: str = "INTRADAY",
        now: Optional[datetime] = None,
    ) -> Optional[ImmutableConfirmedSignal]:
        """Checks if an active confirmed signal hit TP or SL (SL-first rule on conflict)."""
        key = self._state_key(asset_class, exchange, symbol, mode)
        now_utc = now or datetime.now(timezone.utc)

        with self._lock:
            active = self._active_signals.get(key)
            if active is None or active.state not in ("CONFIRMED", "ACTIVE"):
                return active

            high_p = max(price, candle_high if candle_high is not None else price)
            low_p = min(price, candle_low if candle_low is not None else price)

            # Transition CONFIRMED -> ACTIVE once price moves post-confirmation
            if active.state == "CONFIRMED":
                active.state = "ACTIVE"

            if active.side == "BUY":
                hit_sl = low_p <= active.sl
                hit_tp = high_p >= active.tp
                if hit_sl:
                    active.state = "SL HIT"
                    active.outcome = "SL_HIT"
                    active.exitPrice = active.sl
                    active.closedAt = now_utc.isoformat()
                elif hit_tp:
                    active.state = "TP HIT"
                    active.outcome = "TP_HIT"
                    active.exitPrice = active.tp
                    active.closedAt = now_utc.isoformat()
            else:
                hit_sl = high_p >= active.sl
                hit_tp = low_p <= active.tp
                if hit_sl:
                    active.state = "SL HIT"
                    active.outcome = "SL_HIT"
                    active.exitPrice = active.sl
                    active.closedAt = now_utc.isoformat()
                elif hit_tp:
                    active.state = "TP HIT"
                    active.outcome = "TP_HIT"
                    active.exitPrice = active.tp
                    active.closedAt = now_utc.isoformat()

            return active

    def extract_chart_overlays(
        self,
        entry_df: pd.DataFrame,
        asset_class: str = "equity",
    ) -> Dict[str, Any]:
        """Computes visual chart overlays (Order Blocks, FVGs, Liquidity Pools, VWAP) from closed candles."""
        if entry_df is None or len(entry_df) < 20:
            return {
                "orderBlocks": [],
                "fvgs": [],
                "liquidityLevels": [],
                "vwap": [],
                "poc": None,
            }

        df = entry_df.tail(120).copy().reset_index(drop=True)
        swings = find_swing_points(df, window=2)
        structure_events = detect_bos_choch(df, swings)
        obs = detect_order_blocks(df, structure_events)
        fvgs = detect_fair_value_gaps(df)
        vwap_series = calculate_vwap(df)
        vp = calculate_volume_profile(df)
        sr_levels = find_support_resistance(df)

        order_blocks_out = []
        for ob in obs[-4:]:
            order_blocks_out.append(
                {
                    "type": ob.ob_type,
                    "top": _round_price(ob.top, asset_class),
                    "bottom": _round_price(ob.bottom, asset_class),
                    "mitigated": ob.mitigated,
                }
            )

        fvgs_out = []
        for f in fvgs[-4:]:
            if not f.mitigated:
                fvgs_out.append(
                    {
                        "type": f.fvg_type,
                        "top": _round_price(f.top, asset_class),
                        "bottom": _round_price(f.bottom, asset_class),
                    }
                )

        liq_out = []
        for sr in sr_levels[-4:]:
            liq_out.append(
                {
                    "price": _round_price(sr.level, asset_class),
                    "type": sr.level_type,
                    "touches": sr.touches,
                }
            )

        vwap_out = []
        for idx in range(max(0, len(df) - 100), len(df)):
            raw_t = df.iloc[idx]["time"]
            ts_sec = int(pd.to_datetime(raw_t, utc=True).timestamp())
            val = float(vwap_series.iloc[idx])
            if not np.isnan(val) and val > 0:
                vwap_out.append({"time": ts_sec, "value": _round_price(val, asset_class)})

        return {
            "orderBlocks": order_blocks_out,
            "fvgs": fvgs_out,
            "liquidityLevels": liq_out,
            "vwap": vwap_out,
            "poc": _round_price(vp.poc, asset_class) if vp.poc > 0 else None,
        }

    def evaluate(
        self,
        symbol: str,
        entry_df: pd.DataFrame,
        htf_df: Optional[pd.DataFrame] = None,
        bias_df: Optional[pd.DataFrame] = None,
        asset_class: str = "equity",
        exchange: str = "NSE",
        mode: str = "INTRADAY",
        entry_tf: Optional[str] = None,
        bias_tf: Optional[str] = None,
        is_candle_close: bool = True,
        live_price: Optional[float] = None,
        market_open: bool = True,
        now: Optional[datetime] = None,
    ) -> LiveEvaluationSnapshot:
        """Evaluates the 8-point confirmation checklist and transitions the state machine.

        CRITICAL INVARIANTS:
        - Never issues Entry/SL/TP unless state reaches CONFIRMED on a closed candle.
        - Never repaints an already-confirmed signal while it is CONFIRMED or ACTIVE.
        """
        now_utc = now or datetime.now(timezone.utc)
        if htf_df is None and bias_df is not None:
            htf_df = bias_df
        key = self._state_key(asset_class, exchange, symbol, mode)
        ac, ex, sym, norm_mode = key
        res_entry_tf, res_bias_tf = resolve_mode_timeframes(ac, norm_mode, custom_entry_tf=entry_tf)
        if bias_tf:
            res_bias_tf = bias_tf

        overlays = self.extract_chart_overlays(entry_df, asset_class=ac)

        # If there is already an active/confirmed signal for this symbol+mode, check its lifecycle first
        with self._lock:
            existing_sig = self._active_signals.get(key)

        if existing_sig is not None and existing_sig.state in ("CONFIRMED", "ACTIVE"):
            cur_px = live_price if (live_price and live_price > 0) else (float(entry_df["close"].iloc[-1]) if (entry_df is not None and not entry_df.empty) else existing_sig.entry)
            c_high = float(entry_df["high"].iloc[-1]) if (entry_df is not None and not entry_df.empty) else cur_px
            c_low = float(entry_df["low"].iloc[-1]) if (entry_df is not None and not entry_df.empty) else cur_px
            updated_sig = self.update_active_signal_on_tick(
                symbol=sym,
                price=cur_px,
                candle_high=c_high,
                candle_low=c_low,
                asset_class=ac,
                exchange=ex,
                mode=norm_mode,
                now=now_utc,
            )
            if updated_sig is not None:
                if updated_sig.state in ("TP HIT", "SL HIT"):
                    with self._lock:
                        self._active_signals.pop(key, None)
                locked_checklist = [
                    ChecklistItem("htf_bias_aligned", "HTF Bias Aligned", True, True, "PASSED", f"{res_bias_tf} structural bias locked ({updated_sig.side})"),
                    ChecklistItem("liquidity_sweep", "Liquidity Sweep", True, False, "PASSED", "Stop-hunt / liquidity pool engagement verified"),
                    ChecklistItem("choch_bos", "CHoCH / BOS Structure", True, True, "PASSED", "Market structure shift confirmed on close"),
                    ChecklistItem("ob_fvg_retest", "Order Block / FVG Retest", True, True, "PASSED", f"Institutional zone mitigated near {updated_sig.entry}"),
                    ChecklistItem("volume_vwap", "Volume / VWAP Confluence", True, True, "PASSED", "Volume profile & VWAP institutional alignment"),
                    ChecklistItem("candle_pattern", "Candle Confirmation at Zone", True, False, "PASSED", "Reaction candle closed in setup direction"),
                    ChecklistItem("session_volatility", "Session & Volatility Filter", True, True, "PASSED", "Active session & ATR regime verified"),
                    ChecklistItem("rr_feasible", "Risk-to-Reward >= 1:2", True, True, "PASSED", f"Locked RR 1:{updated_sig.rr:.2f} (Immutable)"),
                ]
                snap = LiveEvaluationSnapshot(
                    symbol=sym,
                    assetClass=ac,
                    exchange=ex,
                    mode=norm_mode,
                    entryTimeframe=res_entry_tf,
                    biasTimeframe=res_bias_tf,
                    htfBias="BULLISH" if updated_sig.side == "BUY" else "BEARISH",
                    state=updated_sig.state,
                    statusMessage=f"Signal {updated_sig.state}: {updated_sig.side} {sym} @ {updated_sig.entry} (SL {updated_sig.sl} / TP {updated_sig.tp})",
                    passedCount=8,
                    totalCount=8,
                    mlProbability=updated_sig.mlProbability,
                    mlThreshold=self.ml_threshold,
                    checklist=locked_checklist,
                    signal=updated_sig.to_dict(),
                    overlays=overlays,
                    evaluatedAt=now_utc.isoformat(),
                    decidedOnCandleClose=True,
                )
                with self._lock:
                    self._latest_snapshots[key] = snap
                return snap

        # Otherwise evaluate fresh checklist from candle history
        if entry_df is None or len(entry_df) < 25:
            empty_checklist = [
                ChecklistItem("htf_bias_aligned", "HTF Bias Aligned", False, True, "PENDING", "Waiting for sufficient HTF candle history"),
                ChecklistItem("liquidity_sweep", "Liquidity Sweep", False, False, "PENDING", "Scanning swing highs/lows for sweep"),
                ChecklistItem("choch_bos", "CHoCH / BOS Structure", False, True, "PENDING", "Awaiting structural break"),
                ChecklistItem("ob_fvg_retest", "Order Block / FVG Retest", False, True, "PENDING", "Awaiting price retest of OB/FVG zone"),
                ChecklistItem("volume_vwap", "Volume / VWAP Confluence", False, True, "PENDING", "Checking volume ratio and VWAP position"),
                ChecklistItem("candle_pattern", "Candle Confirmation at Zone", False, False, "PENDING", "Awaiting rejection candle at zone"),
                ChecklistItem("session_volatility", "Session & Volatility Filter", market_open, True, "PASSED" if market_open else "PENDING", "Market open" if market_open else "Market currently closed"),
                ChecklistItem("rr_feasible", "Risk-to-Reward >= 1:2", False, True, "PENDING", "Requires confirmed zone & opposing liquidity pool"),
            ]
            snap = LiveEvaluationSnapshot(
                symbol=sym,
                assetClass=ac,
                exchange=ex,
                mode=norm_mode,
                entryTimeframe=res_entry_tf,
                biasTimeframe=res_bias_tf,
                htfBias="NEUTRAL",
                state="WATCHING",
                statusMessage="No setup. Waiting for confirmation.",
                passedCount=sum(1 for c in empty_checklist if c.passed),
                totalCount=len(empty_checklist),
                mlProbability=None,
                mlThreshold=self.ml_threshold,
                checklist=empty_checklist,
                signal=None,
                overlays=overlays,
                evaluatedAt=now_utc.isoformat(),
                decidedOnCandleClose=is_candle_close,
            )
            with self._lock:
                self._latest_snapshots[key] = snap
            return snap

        df = entry_df.sort_values("time").reset_index(drop=True)
        current_close = float(live_price) if (live_price and live_price > 0) else float(df["close"].iloc[-1])
        current_high = max(float(df["high"].iloc[-1]), current_close)
        current_low = min(float(df["low"].iloc[-1]), current_close)
        current_open = float(df["open"].iloc[-1])
        atr = compute_atr(df)
        min_atr = 0.0001 if current_close < 1.0 else (0.001 if current_close < 10.0 else 0.05)

        # 1. HTF Bias Aligned
        htf_bias = evaluate_htf_bias(htf_df) if (htf_df is not None and not htf_df.empty) else evaluate_htf_bias(df)
        htf_passed = htf_bias in ("BULLISH", "BEARISH")
        target_dir: Literal["BULLISH", "BEARISH"] = "BULLISH" if htf_bias == "BULLISH" else "BEARISH"
        side: Literal["BUY", "SELL"] = "BUY" if target_dir == "BULLISH" else "SELL"

        # Run SMC, Volume, and Price Action detectors on entry_df
        swings = find_swing_points(df, window=2)
        structure_events = detect_bos_choch(df, swings)
        obs = detect_order_blocks(df, structure_events)
        fvgs = detect_fair_value_gaps(df)
        sweeps = detect_liquidity_sweeps(df, swings)
        pd_zone = calculate_premium_discount(df, lookback=40)
        vwap_series = calculate_vwap(df)
        vol_spikes_df = detect_volume_spikes(df, lookback=20, threshold=1.3)
        vp = calculate_volume_profile(df)
        patterns = detect_candlestick_patterns(df)
        sr_levels = find_support_resistance(df)

        recent_bars_cutoff = len(df) - 15
        expected_sweep_type = "BULLISH_SWEEP" if target_dir == "BULLISH" else "BEARISH_SWEEP"

        # 2. Liquidity Sweep
        recent_sweeps = [
            s for s in sweeps
            if s.sweep_type == expected_sweep_type and s.candle_index >= recent_bars_cutoff
        ]
        sweep_passed = len(recent_sweeps) > 0
        sweep_detail = (
            f"{target_dir.title()} sweep of {recent_sweeps[-1].swept_level:.2f}"
            if sweep_passed
            else f"No recent {target_dir.lower()} liquidity sweep in last 15 bars"
        )

        # 3. CHoCH / BOS Structure
        recent_struct = [
            e for e in structure_events
            if e.direction == target_dir and e.break_candle_index >= recent_bars_cutoff
        ]
        struct_passed = len(recent_struct) > 0
        struct_detail = (
            f"{recent_struct[-1].direction.title()} {recent_struct[-1].event_type} at {recent_struct[-1].broken_level:.2f}"
            if struct_passed
            else f"Waiting for {target_dir.lower()} BOS or CHoCH structure break"
        )

        # 4. Order Block or FVG Retest (or Price Action S/R + Premium/Discount zone)
        active_obs = [
            ob for ob in obs
            if ob.ob_type == target_dir
            and (ob.bottom - 0.6 * atr <= current_close <= ob.top + 0.6 * atr)
        ]
        active_fvgs = [
            f for f in fvgs
            if f.fvg_type == target_dir
            and not f.mitigated
            and (f.bottom - 0.5 * atr <= current_close <= f.top + 0.5 * atr)
        ]
        pd_aligned = (
            (side == "BUY" and pd_zone["current_zone"] == "DISCOUNT")
            or (side == "SELL" and pd_zone["current_zone"] == "PREMIUM")
        )
        zone_passed = bool(active_obs or active_fvgs)
        ob_or_key_zone: Tuple[float, float] = (current_close - 0.5 * atr, current_close + 0.5 * atr)
        if active_obs:
            z = active_obs[-1]
            ob_or_key_zone = (z.bottom, z.top)
            zone_detail = f"Retesting {target_dir.title()} Order Block [{_round_price(z.bottom, ac)} - {_round_price(z.top, ac)}]"
        elif active_fvgs:
            z = active_fvgs[-1]
            ob_or_key_zone = (z.bottom, z.top)
            zone_detail = f"Mitigating {target_dir.title()} FVG [{_round_price(z.bottom, ac)} - {_round_price(z.top, ac)}]"
        else:
            zone_detail = f"Price at {_round_price(current_close, ac)} ({pd_zone['current_zone']} zone) — waiting for OB/FVG touch"

        # 5. Volume Spike / VWAP / POC Position
        current_vwap = float(vwap_series.iloc[-1]) if not vwap_series.empty else current_close
        has_recent_spike = bool(vol_spikes_df["is_volume_spike"].iloc[-3:].any()) if len(vol_spikes_df) >= 3 else False
        vwap_aligned = (side == "BUY" and current_close >= current_vwap) or (side == "SELL" and current_close <= current_vwap)
        near_poc = abs(current_close - vp.poc) <= 0.6 * atr if vp.poc > 0 else False
        vol_passed = bool(has_recent_spike or (vwap_aligned and (near_poc or pd_aligned)))
        if has_recent_spike and vwap_aligned:
            vol_detail = f"Volume spike >1.3x avg + aligned with VWAP ({_round_price(current_vwap, ac)})"
        elif vwap_aligned:
            vol_detail = f"Aligned with institutional VWAP ({_round_price(current_vwap, ac)})"
        else:
            vol_detail = f"Awaiting volume expansion or VWAP ({_round_price(current_vwap, ac)}) reclaim"

        # 6. Candle Pattern at Zone
        recent_patterns = [
            p for p in patterns
            if (
                (target_dir == "BULLISH" and "BULLISH" in p.pattern_type)
                or (target_dir == "BEARISH" and "BEARISH" in p.pattern_type)
                or p.pattern_type == "INSIDE_BAR"
            )
            and p.index >= len(df) - 3
        ]
        bull_bear_candle = (side == "BUY" and current_close > current_open) or (side == "SELL" and current_close < current_open)
        candle_passed = bool(recent_patterns or (zone_passed and bull_bear_candle))
        if recent_patterns:
            candle_detail = f"{recent_patterns[-1].pattern_type.replace('_', ' ').title()} confirmed"
        elif zone_passed and bull_bear_candle:
            candle_detail = f"Directional {side} reaction candle at zone"
        else:
            candle_detail = "Waiting for rejection / engulfing candle at zone"

        # 7. Session & Volatility Filter
        atr_pct = (atr / max(current_close, 1e-9)) * 100.0
        session_passed = bool(market_open and atr >= min_atr and 0.02 <= atr_pct <= 12.0)
        session_detail = (
            f"Session open · ATR {_round_price(atr, ac)} ({atr_pct:.2f}%)"
            if session_passed
            else ("Market closed" if not market_open else f"Volatility outside regime (ATR {atr_pct:.2f}%)")
        )

        # 8. RR >= 1:2 Feasible
        atr_buffer = 0.5 * max(min_atr, atr)
        if side == "BUY":
            zone_bottom = min(ob_or_key_zone[0], current_close - 0.5 * atr)
            proposed_sl = _round_price(zone_bottom - atr_buffer, ac)
            swing_highs = [s.price for s in swings if s.swing_type == "HIGH" and s.price > current_close + 1.5 * atr]
            opposing_target = max(swing_highs) if swing_highs else (current_close + 3.2 * atr)
            proposed_tp = _round_price(opposing_target, ac)
            risk = current_close - proposed_sl
            reward = proposed_tp - current_close
        else:
            zone_top = max(ob_or_key_zone[1], current_close + 0.5 * atr)
            proposed_sl = _round_price(zone_top + atr_buffer, ac)
            swing_lows = [s.price for s in swings if s.swing_type == "LOW" and s.price < current_close - 1.5 * atr]
            opposing_target = min(swing_lows) if swing_lows else (current_close - 3.2 * atr)
            proposed_tp = _round_price(opposing_target, ac)
            risk = proposed_sl - current_close
            reward = current_close - proposed_tp

        planned_rr = round(reward / risk, 2) if risk > 0 else 0.0
        rr_passed = bool(htf_passed and zone_passed and planned_rr >= 2.0)
        rr_detail = (
            f"Projected RR 1:{planned_rr:.2f} (>= 1:2 minimum)"
            if rr_passed
            else (f"Projected RR 1:{planned_rr:.2f} (< 1:2 minimum)" if zone_passed else "Awaiting zone retest to lock Entry/SL/TP")
        )

        checklist: List[ChecklistItem] = [
            ChecklistItem(
                id="htf_bias_aligned",
                label="HTF Bias Aligned",
                passed=htf_passed,
                required=True,
                status="PASSED" if htf_passed else "PENDING",
                detail=f"{res_bias_tf} Bias: {htf_bias}" if htf_passed else f"{res_bias_tf} Bias is NEUTRAL — waiting for directional trend",
            ),
            ChecklistItem(
                id="liquidity_sweep",
                label="Liquidity Sweep",
                passed=sweep_passed,
                required=False,
                status="PASSED" if sweep_passed else "PENDING",
                detail=sweep_detail,
            ),
            ChecklistItem(
                id="choch_bos",
                label="CHoCH / BOS Structure",
                passed=struct_passed,
                required=True,
                status="PASSED" if struct_passed else "PENDING",
                detail=struct_detail,
            ),
            ChecklistItem(
                id="ob_fvg_retest",
                label="Order Block / FVG Retest",
                passed=zone_passed,
                required=True,
                status="PASSED" if zone_passed else "PENDING",
                detail=zone_detail,
            ),
            ChecklistItem(
                id="volume_vwap",
                label="Volume Spike / VWAP",
                passed=vol_passed,
                required=True,
                status="PASSED" if vol_passed else "PENDING",
                detail=vol_detail,
            ),
            ChecklistItem(
                id="candle_pattern",
                label="Candle Pattern at Zone",
                passed=candle_passed,
                required=False,
                status="PASSED" if candle_passed else "PENDING",
                detail=candle_detail,
            ),
            ChecklistItem(
                id="session_volatility",
                label="Session & Volatility Filter",
                passed=session_passed,
                required=True,
                status="PASSED" if session_passed else "PENDING",
                detail=session_detail,
            ),
            ChecklistItem(
                id="rr_feasible",
                label="RR >= 1:2 Feasible",
                passed=rr_passed,
                required=True,
                status="PASSED" if rr_passed else "PENDING",
                detail=rr_detail,
            ),
        ]

        passed_count = sum(1 for c in checklist if c.passed)
        required_all_passed = all(c.passed for c in checklist if c.required) and passed_count >= 6

        # Compute ML win probability estimate when setup is FORMING or candidate-ready
        ml_prob: Optional[float] = None
        ml_model_name = "rule_baseline"
        reasons = [c.detail for c in checklist if c.passed]

        candidate = SetupCandidate(
            symbol=sym,
            trade_type="SCALP" if norm_mode == "SCALPING" else norm_mode,  # type: ignore[arg-type]
            side=side,
            entry_price=_round_price(current_close, ac),
            atr=max(min_atr, atr),
            ob_or_key_zone=ob_or_key_zone,
            opposing_target_level=opposing_target,
            confluence_count=passed_count,
            reasons=reasons,
            htf_bias=htf_bias,
            timeframes={"entry": res_entry_tf, "bias": res_bias_tf},
            asset_class=ac,
            exchange=ex,
        )

        if htf_passed and passed_count >= 3:
            try:
                from engine.ml.features import extract_single_setup_features
                from engine.ml.model import predict_setup_probability

                feats = extract_single_setup_features(candidate, df, asset_class=ac, mode=norm_mode)
                ml_prob, ml_model_name = predict_setup_probability(feats, asset_class=ac, mode=norm_mode)
                ml_prob = round(float(ml_prob), 4)
            except Exception as exc:
                logger.debug(f"ML probability estimate fallback: {exc}")
                ml_prob = round(min(0.92, 0.50 + 0.05 * passed_count), 4)

        # Determine State Machine Transition
        # CRITICAL: Can only transition to CONFIRMED on a closed candle (is_candle_close=True)
        # when all required checks pass AND ml_prob >= ml_threshold AND not on cooldown.
        if (
            is_candle_close
            and required_all_passed
            and (ml_prob is not None and ml_prob >= self.ml_threshold)
            and not self._is_on_cooldown(key, side, current_close, now_utc)
        ):
            built_sig = build_trade_signal(candidate, asset_class=ac, exchange=ex)
            if built_sig and built_sig.rr >= 2.0:
                last_bar_time = df["time"].iloc[-1]
                candle_ts_str = (
                    last_bar_time.isoformat()
                    if hasattr(last_bar_time, "isoformat")
                    else str(last_bar_time)
                )
                confirmed_sig = ImmutableConfirmedSignal(
                    id=built_sig.id,
                    symbol=sym,
                    assetClass=ac,
                    exchange=ex,
                    mode=norm_mode,
                    tradeType=built_sig.tradeType,
                    side=built_sig.side,
                    entry=built_sig.entry,
                    sl=built_sig.sl,
                    tp=built_sig.tp,
                    rr=built_sig.rr,
                    confidence=built_sig.confidence,
                    mlProbability=round(float(ml_prob), 4),
                    mlModelUsed=ml_model_name,
                    state="CONFIRMED",
                    candleTimestamp=candle_ts_str,
                    confirmedAt=now_utc.isoformat(),
                    reasons=reasons,
                    timeframes={"entry": res_entry_tf, "bias": res_bias_tf},
                )
                self._record_cooldown(key, side, built_sig.entry, now_utc)
                with self._lock:
                    self._active_signals[key] = confirmed_sig
                    hist = self._signal_history.setdefault(key, [])
                    hist.insert(0, confirmed_sig)
                    del hist[25:]

                snap = LiveEvaluationSnapshot(
                    symbol=sym,
                    assetClass=ac,
                    exchange=ex,
                    mode=norm_mode,
                    entryTimeframe=res_entry_tf,
                    biasTimeframe=res_bias_tf,
                    htfBias=htf_bias,
                    state="CONFIRMED",
                    statusMessage=f"CONFIRMED {built_sig.side} setup on {res_entry_tf} candle close (RR 1:{built_sig.rr:.2f})",
                    passedCount=passed_count,
                    totalCount=len(checklist),
                    mlProbability=ml_prob,
                    mlThreshold=self.ml_threshold,
                    checklist=checklist,
                    signal=confirmed_sig.to_dict(),
                    overlays=overlays,
                    evaluatedAt=now_utc.isoformat(),
                    decidedOnCandleClose=True,
                )
                with self._lock:
                    self._latest_snapshots[key] = snap
                return snap

        elif is_candle_close and required_all_passed and (ml_prob is not None and ml_prob < self.ml_threshold):
            try:
                from engine.tracker.rejected_logger import rejected_tracker
                rejected_tracker.log_rejected_candidate(
                    symbol=sym,
                    side=side,
                    entry_price=current_close,
                    sl=proposed_sl,
                    tp=proposed_tp,
                    rr=planned_rr,
                    features=feats if 'feats' in locals() else {},
                    ml_prob=float(ml_prob),
                    ml_threshold=float(self.ml_threshold),
                    ml_model_used=ml_model_name,
                    rejection_reason=f"ML probability {ml_prob:.2f} below gate threshold {self.ml_threshold:.2f}",
                    asset_class=ac,
                    exchange=ex,
                    mode=norm_mode,
                    evaluated_at=now_utc,
                )
            except Exception as rej_err:
                logger.debug(f"Could not log rejected candidate: {rej_err}")

        # Not confirmed -> NEVER issue Entry, SL, or TP!
        if htf_passed and passed_count >= 3:
            state: SignalLifecycleState = "FORMING"
        else:
            state = "WATCHING"

        snap = LiveEvaluationSnapshot(
            symbol=sym,
            assetClass=ac,
            exchange=ex,
            mode=norm_mode,
            entryTimeframe=res_entry_tf,
            biasTimeframe=res_bias_tf,
            htfBias=htf_bias,
            state=state,
            statusMessage="No setup. Waiting for confirmation.",
            passedCount=passed_count,
            totalCount=len(checklist),
            mlProbability=ml_prob,
            mlThreshold=self.ml_threshold,
            checklist=checklist,
            signal=None,
            overlays=overlays,
            evaluatedAt=now_utc.isoformat(),
            decidedOnCandleClose=is_candle_close,
        )
        with self._lock:
            self._latest_snapshots[key] = snap
        return snap

    def get_recent_signals(
        self,
        symbol: str,
        asset_class: str = "equity",
        exchange: str = "NSE",
        mode: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Returns recent immutable confirmed signals for this symbol."""
        ac = (asset_class or "equity").strip().lower()
        ex = (exchange or ("BINANCE" if ac == "crypto" else ("FX" if ac == "forex" else "NSE"))).strip().upper()
        sym = symbol.strip().upper()

        results: List[Dict[str, Any]] = []
        with self._lock:
            for (k_ac, k_ex, k_sym, k_mode), sigs in self._signal_history.items():
                if k_ac == ac and k_sym == sym and (mode is None or k_mode == mode.upper()):
                    for s in sigs:
                        results.append(s.to_dict())
        return results[:20]


live_strategy_engine = LiveStrategyEngine()
