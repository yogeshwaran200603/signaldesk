"""Confluence scorer and multi-timeframe pipeline for SignalDesk.

Pipelines:
- INTRADAY: 1h & 15m for bias, 5m for entry setup
- DELIVERY: Weekly for bias, Daily for entry setup
- BOTH: Evaluates both pipelines, tagging signals appropriately

Scorer:
Requires alignment with Higher-Timeframe (HTF) bias and at least 3 independent conditions.
Stores detailed human-readable reasons[] on each signal candidate.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional, Tuple
import pandas as pd
import numpy as np

from engine.strategies.smc import (
    find_swing_points,
    detect_bos_choch,
    detect_order_blocks,
    detect_fair_value_gaps,
    detect_liquidity_sweeps,
    calculate_premium_discount,
    OrderBlock,
    FairValueGap,
)
from engine.strategies.volume import (
    calculate_vwap,
    detect_volume_spikes,
    calculate_volume_profile,
)
from engine.strategies.price_action import (
    find_support_resistance,
    detect_candlestick_patterns,
)


@dataclass
class SetupCandidate:
    symbol: str
    trade_type: Literal["INTRADAY", "DELIVERY", "SCALP", "SWING"]
    side: Literal["BUY", "SELL"]
    entry_price: float
    ob_or_key_zone: Tuple[float, float]
    opposing_target_level: float
    atr: float
    reasons: List[str] = field(default_factory=list)
    confluence_count: int = 0
    htf_bias: str = "NEUTRAL"
    timeframes: Dict[str, str] = field(default_factory=dict)
    timestamp: Any = None
    asset_class: str = "equity"
    exchange: str = "NSE"


def evaluate_htf_bias(df: pd.DataFrame) -> Literal["BULLISH", "BEARISH", "NEUTRAL"]:
    """Determines higher-timeframe trend bias using market structure and moving averages."""
    if len(df) < 15:
        return "NEUTRAL"

    closes = df["close"].values
    swings = find_swing_points(df, window=2)
    events = detect_bos_choch(df, swings)

    # Calculate 20 & 50 period EMAs
    ema20 = df["close"].ewm(span=20, adjust=False).mean().iloc[-1]
    ema50 = df["close"].ewm(span=50, adjust=False).mean().iloc[-1] if len(df) >= 50 else ema20

    cur_close = closes[-1]

    # Check recent structure
    last_event = events[-1] if events else None
    structure_bullish = last_event and last_event.direction == "BULLISH"
    structure_bearish = last_event and last_event.direction == "BEARISH"

    # Swing high / low progression
    recent_swings = swings[-4:] if len(swings) >= 4 else swings
    swing_highs = [s.price for s in recent_swings if s.swing_type == "HIGH"]
    swing_lows = [s.price for s in recent_swings if s.swing_type == "LOW"]

    hh_hl = (
        len(swing_highs) >= 2
        and swing_highs[-1] > swing_highs[-2]
        and len(swing_lows) >= 2
        and swing_lows[-1] > swing_lows[-2]
    )
    lh_ll = (
        len(swing_highs) >= 2
        and swing_highs[-1] < swing_highs[-2]
        and len(swing_lows) >= 2
        and swing_lows[-1] < swing_lows[-2]
    )

    if (structure_bullish or hh_hl) and cur_close >= ema20:
        return "BULLISH"
    elif (structure_bearish or lh_ll) and cur_close <= ema20:
        return "BEARISH"
    elif cur_close > ema50 and ema20 >= ema50:
        return "BULLISH"
    elif cur_close < ema50 and ema20 <= ema50:
        return "BEARISH"

    return "NEUTRAL"


def compute_atr(df: pd.DataFrame, period: int = 14) -> float:
    """Computes Average True Range (ATR)."""
    if len(df) < 2:
        return float(df["high"].iloc[-1] - df["low"].iloc[-1]) if not df.empty else 1.0

    highs = df["high"].values
    lows = df["low"].values
    closes = df["close"].values

    tr = np.zeros(len(df))
    tr[0] = highs[0] - lows[0]
    for i in range(1, len(df)):
        tr[i] = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1]),
        )

    atr_series = pd.Series(tr).rolling(window=period, min_periods=1).mean()
    return float(atr_series.iloc[-1])


def scan_timeframe_setup(
    symbol: str,
    entry_df: pd.DataFrame,
    htf_bias: Literal["BULLISH", "BEARISH", "NEUTRAL"],
    trade_type: Literal["INTRADAY", "DELIVERY", "SCALP", "SWING"],
    timeframes_meta: Dict[str, str],
    asset_class: str = "equity",
    exchange: str = "NSE",
) -> Optional[SetupCandidate]:
    """Analyzes entry timeframe data against HTF bias and evaluates confluence.

    Conditions checked (at least 3 must align with HTF bias):
    1. HTF Bias alignment
    2. Recent Liquidity Sweep
    3. BOS / CHoCH on entry timeframe
    4. Active Order Block / FVG Retest
    5. Volume Spike or VWAP/POC reaction
    6. Price action candlestick pattern confirmation
    7. Premium / Discount zone equilibrium
    """
    if len(entry_df) < 20 or htf_bias == "NEUTRAL":
        return None

    cur_idx = len(entry_df) - 1
    cur_price = float(entry_df["close"].iloc[-1])
    atr = compute_atr(entry_df, period=14)

    swings = find_swing_points(entry_df, window=2)
    events = detect_bos_choch(entry_df, swings)
    order_blocks = detect_order_blocks(entry_df, events)
    fvgs = detect_fair_value_gaps(entry_df)
    sweeps = detect_liquidity_sweeps(entry_df, swings)
    pd_zone = calculate_premium_discount(entry_df, lookback=40)
    vol_spikes = detect_volume_spikes(entry_df, lookback=20, threshold=1.4)
    vol_profile = calculate_volume_profile(entry_df.iloc[-40:], bins=25)
    patterns = detect_candlestick_patterns(entry_df)

    recent_sweeps = [s for s in sweeps if (cur_idx - s.candle_index) <= 20]
    recent_events = [e for e in events if (cur_idx - e.break_candle_index) <= 20]
    recent_patterns = [p for p in patterns if (cur_idx - p.index) <= 3]
    recent_vol_spike = vol_spikes["is_volume_spike"].iloc[-3:].any()

    # Opposing target levels (liquidity pools)
    swing_highs = [s for s in swings if s.swing_type == "HIGH" and s.price > cur_price]
    swing_lows = [s for s in swings if s.swing_type == "LOW" and s.price < cur_price]

    # --- CASE 1: BULLISH / BUY SETUP ---
    if htf_bias == "BULLISH":
        reasons: List[str] = []
        confluence_count = 0

        # Condition 1: HTF Bias
        confluence_count += 1
        reasons.append(f"Higher timeframe bias is BULLISH ({timeframes_meta.get('bias', '')})")

        # Condition 2: Sell-side Liquidity Sweep
        bullish_sweeps = [s for s in recent_sweeps if s.sweep_type == "BULLISH_SWEEP"]
        if bullish_sweeps:
            last_sweep = bullish_sweeps[-1]
            confluence_count += 1
            reasons.append(f"Sell-side liquidity swept at {last_sweep.swept_level:.2f} with wick rejection")

        # Condition 3: Structure Break / CHoCH
        bullish_events = [e for e in recent_events if e.direction == "BULLISH"]
        if bullish_events:
            last_ev = bullish_events[-1]
            confluence_count += 1
            reasons.append(f"{last_ev.event_type} shift confirmed breaking above {last_ev.broken_level:.2f}")

        # Condition 4: Order Block or FVG Retest
        active_bullish_obs = [ob for ob in order_blocks if ob.ob_type == "BULLISH" and not ob.mitigated]
        active_bullish_fvgs = [fvg for fvg in fvgs if fvg.fvg_type == "BULLISH" and not fvg.mitigated]

        zone_retest = False
        target_ob_zone: Tuple[float, float] = (cur_price - atr, cur_price)

        for ob in reversed(active_bullish_obs):
            # Price in or near OB [bottom, top]
            if cur_price >= ob.bottom * 0.998 and cur_price <= ob.top * 1.005:
                zone_retest = True
                target_ob_zone = (ob.bottom, ob.top)
                confluence_count += 1
                reasons.append(f"Retesting active Bullish Order Block zone [{ob.bottom:.2f} - {ob.top:.2f}]")
                break

        if not zone_retest:
            for fvg in reversed(active_bullish_fvgs):
                if cur_price >= fvg.bottom * 0.998 and cur_price <= fvg.top * 1.005:
                    zone_retest = True
                    target_ob_zone = (fvg.bottom, fvg.top)
                    confluence_count += 1
                    reasons.append(f"Retesting active Bullish FVG imbalance [{fvg.bottom:.2f} - {fvg.top:.2f}]")
                    break

        # Condition 5: Volume Surge / Profile Reaction
        if recent_vol_spike or (vol_profile.poc > 0 and abs(cur_price - vol_profile.poc) / cur_price < 0.005):
            confluence_count += 1
            ratio = float(vol_spikes["vol_ratio"].iloc[-1])
            reasons.append(f"Volume confirmation: {ratio:.1f}x surge / testing Volume Profile POC ({vol_profile.poc:.2f})")

        # Condition 6: Price Action Confirmation
        bullish_pas = [p for p in recent_patterns if p.pattern_type in ("BULLISH_ENGULFING", "BULLISH_PIN_BAR")]
        if bullish_pas:
            p_type = bullish_pas[-1].pattern_type.replace("_", " ").title()
            confluence_count += 1
            reasons.append(f"Price action confirmation: {p_type} rejection at key support")

        # Condition 7: Discount Zone
        if pd_zone["current_zone"] == "DISCOUNT":
            confluence_count += 1
            reasons.append(f"Discount zone entry at {pd_zone['percent_depth']*100:.1f}% of dealing range")

        if confluence_count >= 3:
            # Target next opposing liquidity pool
            target_tp = swing_highs[0].price if swing_highs else cur_price + 2.5 * atr

            return SetupCandidate(
                symbol=symbol,
                trade_type=trade_type,
                side="BUY",
                entry_price=cur_price,
                ob_or_key_zone=target_ob_zone,
                opposing_target_level=target_tp,
                atr=atr,
                reasons=reasons,
                confluence_count=confluence_count,
                htf_bias="BULLISH",
                timeframes=timeframes_meta,
                timestamp=entry_df["time"].iloc[-1] if "time" in entry_df.columns else None,
                asset_class=asset_class,
                exchange=exchange,
            )

    # --- CASE 2: BEARISH / SELL SETUP ---
    elif htf_bias == "BEARISH":
        reasons = []
        confluence_count = 0

        # Condition 1: HTF Bias
        confluence_count += 1
        reasons.append(f"Higher timeframe bias is BEARISH ({timeframes_meta.get('bias', '')})")

        # Condition 2: Buy-side Liquidity Sweep
        bearish_sweeps = [s for s in recent_sweeps if s.sweep_type == "BEARISH_SWEEP"]
        if bearish_sweeps:
            last_sweep = bearish_sweeps[-1]
            confluence_count += 1
            reasons.append(f"Buy-side liquidity swept at {last_sweep.swept_level:.2f} with wick rejection")

        # Condition 3: Structure Break / CHoCH
        bearish_events = [e for e in recent_events if e.direction == "BEARISH"]
        if bearish_events:
            last_ev = bearish_events[-1]
            confluence_count += 1
            reasons.append(f"{last_ev.event_type} shift confirmed breaking below {last_ev.broken_level:.2f}")

        # Condition 4: Order Block or FVG Retest
        active_bearish_obs = [ob for ob in order_blocks if ob.ob_type == "BEARISH" and not ob.mitigated]
        active_bearish_fvgs = [fvg for fvg in fvgs if fvg.fvg_type == "BEARISH" and not fvg.mitigated]

        zone_retest = False
        target_ob_zone = (cur_price, cur_price + atr)

        for ob in reversed(active_bearish_obs):
            if cur_price >= ob.bottom * 0.995 and cur_price <= ob.top * 1.002:
                zone_retest = True
                target_ob_zone = (ob.bottom, ob.top)
                confluence_count += 1
                reasons.append(f"Retesting active Bearish Order Block zone [{ob.bottom:.2f} - {ob.top:.2f}]")
                break

        if not zone_retest:
            for fvg in reversed(active_bearish_fvgs):
                if cur_price >= fvg.bottom * 0.995 and cur_price <= fvg.top * 1.002:
                    zone_retest = True
                    target_ob_zone = (fvg.bottom, fvg.top)
                    confluence_count += 1
                    reasons.append(f"Retesting active Bearish FVG imbalance [{fvg.bottom:.2f} - {fvg.top:.2f}]")
                    break

        # Condition 5: Volume Surge / Profile Reaction
        if recent_vol_spike or (vol_profile.poc > 0 and abs(cur_price - vol_profile.poc) / cur_price < 0.005):
            confluence_count += 1
            ratio = float(vol_spikes["vol_ratio"].iloc[-1])
            reasons.append(f"Volume confirmation: {ratio:.1f}x surge / testing Volume Profile POC ({vol_profile.poc:.2f})")

        # Condition 6: Price Action Confirmation
        bearish_pas = [p for p in recent_patterns if p.pattern_type in ("BEARISH_ENGULFING", "BEARISH_PIN_BAR")]
        if bearish_pas:
            p_type = bearish_pas[-1].pattern_type.replace("_", " ").title()
            confluence_count += 1
            reasons.append(f"Price action confirmation: {p_type} rejection at key resistance")

        # Condition 7: Premium Zone
        if pd_zone["current_zone"] == "PREMIUM":
            confluence_count += 1
            reasons.append(f"Premium zone entry at {pd_zone['percent_depth']*100:.1f}% of dealing range")

        if confluence_count >= 3:
            # Target next opposing liquidity pool
            target_tp = swing_lows[-1].price if swing_lows else cur_price - 2.5 * atr

            return SetupCandidate(
                symbol=symbol,
                trade_type=trade_type,
                side="SELL",
                entry_price=cur_price,
                ob_or_key_zone=target_ob_zone,
                opposing_target_level=target_tp,
                atr=atr,
                reasons=reasons,
                confluence_count=confluence_count,
                htf_bias="BEARISH",
                timeframes=timeframes_meta,
                timestamp=entry_df["time"].iloc[-1] if "time" in entry_df.columns else None,
                asset_class=asset_class,
                exchange=exchange,
            )

    return None
