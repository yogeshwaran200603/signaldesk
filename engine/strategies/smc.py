"""Smart Money Concepts (SMC) strategy module for SignalDesk.

Implements:
- Swing Highs / Lows (with confirmation lag to eliminate lookahead bias)
- Break of Structure (BOS) & Change of Character (CHoCH)
- Order Blocks (Bullish / Bearish, tracked mitigation status)
- Fair Value Gaps (FVG 3-candle imbalances with mitigation tracking)
- Liquidity Sweeps (Equal Highs/Lows and wick run & close back inside)
- Premium vs Discount zones based on dealing range equilibrium
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional, Tuple
import pandas as pd
import numpy as np


@dataclass
class SwingPoint:
    index: int
    time: Any = None
    price: float = 0.0
    swing_type: Literal["HIGH", "LOW"] = "HIGH"
    confirmed_at: int = 0  # Candle index when this swing became confirmed


@dataclass
class StructureEvent:
    event_type: Literal["BOS", "CHOCH"]
    direction: Literal["BULLISH", "BEARISH"]
    broken_swing_index: int
    break_candle_index: int
    broken_level: float
    break_price: float
    time: Any = None


@dataclass
class OrderBlock:
    ob_type: Literal["BULLISH", "BEARISH"]
    candle_index: int
    top: float
    bottom: float
    mitigated: bool = False
    mitigated_at: Optional[int] = None
    time: Any = None


@dataclass
class FairValueGap:
    fvg_type: Literal["BULLISH", "BEARISH"]
    candle_index: int  # index of candle 3 where gap is confirmed
    top: float
    bottom: float
    mitigated: bool = False
    mitigated_at: Optional[int] = None
    time: Any = None


@dataclass
class LiquiditySweep:
    sweep_type: Literal["BULLISH_SWEEP", "BEARISH_SWEEP"]  # BULLISH_SWEEP = swept lows and bounced up
    candle_index: int
    swept_level: float
    wick_extreme: float
    close_price: float
    time: Any = None


def find_swing_points(df: pd.DataFrame, window: int = 2) -> List[SwingPoint]:
    """Identifies swing highs and swing lows without lookahead bias.

    A swing high at index i requires high[i] > high[i-j] and high[i] > high[i+j] for j=1..window.
    It is ONLY confirmed at index i + window.
    """
    if len(df) < (2 * window + 1):
        return []

    highs = df["high"].values
    lows = df["low"].values
    n = len(df)
    swings: List[SwingPoint] = []

    for i in range(window, n - window):
        # Check swing high
        is_swing_high = True
        for j in range(1, window + 1):
            if highs[i] <= highs[i - j] or highs[i] <= highs[i + j]:
                is_swing_high = False
                break
        if is_swing_high:
            swings.append(
                SwingPoint(
                    index=i,
                    time=df["time"].iloc[i] if "time" in df.columns else i,
                    price=float(highs[i]),
                    swing_type="HIGH",
                    confirmed_at=i + window,
                )
            )

        # Check swing low
        is_swing_low = True
        for j in range(1, window + 1):
            if lows[i] >= lows[i - j] or lows[i] >= lows[i + j]:
                is_swing_low = False
                break
        if is_swing_low:
            swings.append(
                SwingPoint(
                    index=i,
                    time=df["time"].iloc[i] if "time" in df.columns else i,
                    price=float(lows[i]),
                    swing_type="LOW",
                    confirmed_at=i + window,
                )
            )

    swings.sort(key=lambda s: s.index)
    return swings


def detect_bos_choch(
    df: pd.DataFrame, swings: List[SwingPoint]
) -> List[StructureEvent]:
    """Detects Break of Structure (BOS) and Change of Character (CHoCH).

    - BOS: Breaks confirmed swing in direction of current trend.
    - CHoCH: Breaks last opposing confirmed swing, signalling trend reversal.
    Evaluates strictly candle-by-candle using only swings confirmed by that candle.
    """
    if not swings or len(df) == 0:
        return []

    closes = df["close"].values
    n = len(df)
    events: List[StructureEvent] = []

    current_trend: Optional[Literal["BULLISH", "BEARISH"]] = None
    last_confirmed_high: Optional[SwingPoint] = None
    last_confirmed_low: Optional[SwingPoint] = None

    swing_ptr = 0
    swings_by_conf = sorted(swings, key=lambda s: s.confirmed_at)

    for k in range(n):
        # Ingest swings that became confirmed at or before candle k
        while swing_ptr < len(swings_by_conf) and swings_by_conf[swing_ptr].confirmed_at <= k:
            sp = swings_by_conf[swing_ptr]
            if sp.swing_type == "HIGH":
                last_confirmed_high = sp
            else:
                last_confirmed_low = sp
            swing_ptr += 1

        cur_close = closes[k]

        # Check bullish break (close > last confirmed swing high)
        if last_confirmed_high and cur_close > last_confirmed_high.price:
            event_type: Literal["BOS", "CHOCH"] = "CHOCH" if current_trend == "BEARISH" else "BOS"
            events.append(
                StructureEvent(
                    event_type=event_type,
                    direction="BULLISH",
                    broken_swing_index=last_confirmed_high.index,
                    break_candle_index=k,
                    broken_level=last_confirmed_high.price,
                    break_price=float(cur_close),
                    time=df["time"].iloc[k] if "time" in df.columns else k,
                )
            )
            current_trend = "BULLISH"
            last_confirmed_high = None  # Consume swing so it doesn't re-trigger

        # Check bearish break (close < last confirmed swing low)
        if last_confirmed_low and cur_close < last_confirmed_low.price:
            event_type: Literal["BOS", "CHOCH"] = "CHOCH" if current_trend == "BULLISH" else "BOS"
            events.append(
                StructureEvent(
                    event_type=event_type,
                    direction="BEARISH",
                    broken_swing_index=last_confirmed_low.index,
                    break_candle_index=k,
                    broken_level=last_confirmed_low.price,
                    break_price=float(cur_close),
                    time=df["time"].iloc[k] if "time" in df.columns else k,
                )
            )
            current_trend = "BEARISH"
            last_confirmed_low = None  # Consume swing

    return events


def detect_order_blocks(
    df: pd.DataFrame, structure_events: List[StructureEvent]
) -> List[OrderBlock]:
    """Identifies Bullish and Bearish Order Blocks originated prior to BOS/CHoCH breakouts.

    - Bullish OB: The last down candle (or lowest candle) prior to a bullish break.
    - Bearish OB: The last up candle (or highest candle) prior to a bearish break.
    Checks subsequent candles to track whether the OB has been mitigated.
    """
    if df.empty or not structure_events:
        return []

    opens = df["open"].values
    highs = df["high"].values
    lows = df["low"].values
    closes = df["close"].values
    n = len(df)
    order_blocks: List[OrderBlock] = []

    for evt in structure_events:
        break_idx = evt.break_candle_index
        # Look back from breakout candle to find the origin consolidation / opposite candle
        lookback_start = max(0, break_idx - 10)
        ob_candle_idx = None

        if evt.direction == "BULLISH":
            # Find the lowest/bearish candle before the impulsive up move
            lowest_val = float("inf")
            for idx in range(break_idx - 1, lookback_start - 1, -1):
                if closes[idx] < opens[idx] or lows[idx] < lowest_val:
                    ob_candle_idx = idx
                    lowest_val = lows[idx]
                    break
            if ob_candle_idx is None:
                ob_candle_idx = max(0, break_idx - 1)

            ob = OrderBlock(
                ob_type="BULLISH",
                candle_index=ob_candle_idx,
                top=float(highs[ob_candle_idx]),
                bottom=float(lows[ob_candle_idx]),
                time=df["time"].iloc[ob_candle_idx] if "time" in df.columns else ob_candle_idx,
            )

            # Check mitigation from break_idx onwards
            for m_idx in range(break_idx + 1, n):
                if lows[m_idx] <= ob.top and highs[m_idx] >= ob.bottom:
                    ob.mitigated = True
                    ob.mitigated_at = m_idx
                    break
            order_blocks.append(ob)

        else:
            # Bearish: Find the highest/bullish candle before impulsive drop
            highest_val = float("-inf")
            for idx in range(break_idx - 1, lookback_start - 1, -1):
                if closes[idx] > opens[idx] or highs[idx] > highest_val:
                    ob_candle_idx = idx
                    highest_val = highs[idx]
                    break
            if ob_candle_idx is None:
                ob_candle_idx = max(0, break_idx - 1)

            ob = OrderBlock(
                ob_type="BEARISH",
                candle_index=ob_candle_idx,
                top=float(highs[ob_candle_idx]),
                bottom=float(lows[ob_candle_idx]),
                time=df["time"].iloc[ob_candle_idx] if "time" in df.columns else ob_candle_idx,
            )

            # Check mitigation from break_idx onwards
            for m_idx in range(break_idx + 1, n):
                if highs[m_idx] >= ob.bottom and lows[m_idx] <= ob.top:
                    ob.mitigated = True
                    ob.mitigated_at = m_idx
                    break
            order_blocks.append(ob)

    return order_blocks


def detect_fair_value_gaps(df: pd.DataFrame) -> List[FairValueGap]:
    """Identifies 3-candle Fair Value Gaps (imbalances).

    - Bullish FVG: High of candle 1 < Low of candle 3. Gap = [High[1], Low[3]].
    - Bearish FVG: Low of candle 1 > High of candle 3. Gap = [High[3], Low[1]].
    Tracks mitigation as price revisits the gap in subsequent bars.
    """
    if len(df) < 3:
        return []

    highs = df["high"].values
    lows = df["low"].values
    n = len(df)
    fvgs: List[FairValueGap] = []

    for i in range(2, n):
        c1_high = highs[i - 2]
        c1_low = lows[i - 2]
        c3_high = highs[i]
        c3_low = lows[i]

        # Bullish FVG
        if c1_high < c3_low:
            gap = FairValueGap(
                fvg_type="BULLISH",
                candle_index=i,
                top=float(c3_low),
                bottom=float(c1_high),
                time=df["time"].iloc[i] if "time" in df.columns else i,
            )
            # Check mitigation after formation
            for m_idx in range(i + 1, n):
                if lows[m_idx] <= gap.top:
                    gap.mitigated = True
                    gap.mitigated_at = m_idx
                    break
            fvgs.append(gap)

        # Bearish FVG
        elif c1_low > c3_high:
            gap = FairValueGap(
                fvg_type="BEARISH",
                candle_index=i,
                top=float(c1_low),
                bottom=float(c3_high),
                time=df["time"].iloc[i] if "time" in df.columns else i,
            )
            # Check mitigation after formation
            for m_idx in range(i + 1, n):
                if highs[m_idx] >= gap.bottom:
                    gap.mitigated = True
                    gap.mitigated_at = m_idx
                    break
            fvgs.append(gap)

    return fvgs


def detect_liquidity_sweeps(
    df: pd.DataFrame,
    swings: List[SwingPoint],
    tolerance_pct: float = 0.0015,
) -> List[LiquiditySweep]:
    """Detects liquidity sweeps / purges on swing highs/lows or equal highs/lows.

    A sweep occurs when a candle wick breaks beyond a confirmed swing or EQH/EQL level
    to raid stop orders, but the body CLOSES back within the level (rejection).
    """
    if df.empty or not swings:
        return []

    highs = df["high"].values
    lows = df["low"].values
    closes = df["close"].values
    opens = df["open"].values
    n = len(df)
    sweeps: List[LiquiditySweep] = []

    swing_highs = [s for s in swings if s.swing_type == "HIGH"]
    swing_lows = [s for s in swings if s.swing_type == "LOW"]

    for k in range(n):
        cur_high = highs[k]
        cur_low = lows[k]
        cur_close = closes[k]
        cur_open = opens[k]

        # Check sweep of confirmed swing lows (Bullish sweep / raid on sell-side liquidity)
        for sl in swing_lows:
            if sl.confirmed_at <= k and (k - sl.index) <= 60:
                # Candle dipped below swing low, but closed ABOVE swing low
                if cur_low < sl.price and cur_close > sl.price:
                    sweeps.append(
                        LiquiditySweep(
                            sweep_type="BULLISH_SWEEP",
                            candle_index=k,
                            swept_level=sl.price,
                            wick_extreme=float(cur_low),
                            close_price=float(cur_close),
                            time=df["time"].iloc[k] if "time" in df.columns else k,
                        )
                    )
                    break

        # Check sweep of confirmed swing highs (Bearish sweep / raid on buy-side liquidity)
        for sh in swing_highs:
            if sh.confirmed_at <= k and (k - sh.index) <= 60:
                # Candle pierced above swing high, but closed BELOW swing high
                if cur_high > sh.price and cur_close < sh.price:
                    sweeps.append(
                        LiquiditySweep(
                            sweep_type="BEARISH_SWEEP",
                            candle_index=k,
                            swept_level=sh.price,
                            wick_extreme=float(cur_high),
                            close_price=float(cur_close),
                            time=df["time"].iloc[k] if "time" in df.columns else k,
                        )
                    )
                    break

    return sweeps


def calculate_premium_discount(
    df: pd.DataFrame, lookback: int = 50
) -> Dict[str, Any]:
    """Calculates Dealing Range Equilibrium, Premium, and Discount zones.

    - Range High: Max high of lookback period
    - Range Low: Min low of lookback period
    - Equilibrium: 50% midpoint
    - Discount (<50%): Ideal for Buy setups
    - Premium (>50%): Ideal for Sell setups
    """
    if len(df) == 0:
        return {
            "range_high": 0.0,
            "range_low": 0.0,
            "equilibrium": 0.0,
            "current_zone": "NEUTRAL",
            "percent_depth": 0.5,
        }

    slice_df = df.iloc[-lookback:] if len(df) >= lookback else df
    range_high = float(slice_df["high"].max())
    range_low = float(slice_df["low"].min())
    equilibrium = (range_high + range_low) / 2.0
    current_close = float(df["close"].iloc[-1])

    spread = range_high - range_low
    if spread <= 0:
        percent_depth = 0.5
    else:
        percent_depth = (current_close - range_low) / spread

    zone = "PREMIUM" if current_close > equilibrium else "DISCOUNT"
    return {
        "range_high": range_high,
        "range_low": range_low,
        "equilibrium": equilibrium,
        "current_zone": zone,
        "percent_depth": percent_depth,
    }
