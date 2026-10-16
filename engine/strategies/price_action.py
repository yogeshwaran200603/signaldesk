"""Price action analysis module for SignalDesk.

Implements:
- Support and Resistance levels detection (clustering touches)
- Candlestick Patterns: Bullish/Bearish Engulfing, Bullish/Bearish Pin Bar (Hammer/Shooting Star), Inside Bar
- Zone confirmation helper (checking pattern occurrence at key S/R or OB zones)
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional, Tuple
import numpy as np
import pandas as pd


@dataclass
class SRLevel:
    level: float
    level_type: Literal["SUPPORT", "RESISTANCE"]
    touches: int
    strength: float


@dataclass
class CandlestickPattern:
    index: int
    pattern_type: Literal[
        "BULLISH_ENGULFING",
        "BEARISH_ENGULFING",
        "BULLISH_PIN_BAR",
        "BEARISH_PIN_BAR",
        "INSIDE_BAR",
    ]
    price: float
    time: Any = None


def find_support_resistance(
    df: pd.DataFrame, tolerance_pct: float = 0.005, min_touches: int = 2
) -> List[SRLevel]:
    """Finds key horizontal support and resistance levels by clustering local price extrema."""
    if len(df) < 10:
        return []

    highs = df["high"].values
    lows = df["low"].values
    closes = df["close"].values
    cur_price = closes[-1]

    # Collect candidate levels from swing extrema
    candidates: List[Tuple[float, Literal["SUPPORT", "RESISTANCE"]]] = []
    for i in range(2, len(df) - 2):
        if highs[i] > highs[i - 1] and highs[i] > highs[i + 1]:
            candidates.append((float(highs[i]), "RESISTANCE"))
        if lows[i] < lows[i - 1] and lows[i] < lows[i + 1]:
            candidates.append((float(lows[i]), "SUPPORT"))

    if not candidates:
        return []

    # Cluster nearby candidate levels within tolerance_pct
    clusters: List[Dict[str, Any]] = []
    for price, l_type in candidates:
        matched = False
        for c in clusters:
            if abs(c["level"] - price) / c["level"] <= tolerance_pct:
                c["prices"].append(price)
                c["touches"] += 1
                c["level"] = sum(c["prices"]) / len(c["prices"])
                matched = True
                break
        if not matched:
            clusters.append(
                {"level": price, "prices": [price], "touches": 1, "type": l_type}
            )

    levels: List[SRLevel] = []
    for c in clusters:
        if c["touches"] >= min_touches:
            # Reclassify based on relation to current price
            actual_type: Literal["SUPPORT", "RESISTANCE"] = (
                "SUPPORT" if c["level"] <= cur_price else "RESISTANCE"
            )
            strength = min(1.0, c["touches"] * 0.25)
            levels.append(
                SRLevel(
                    level=float(c["level"]),
                    level_type=actual_type,
                    touches=c["touches"],
                    strength=strength,
                )
            )

    levels.sort(key=lambda x: x.level)
    return levels


def detect_candlestick_patterns(df: pd.DataFrame) -> List[CandlestickPattern]:
    """Scans DataFrame for classic reversal & continuation price action patterns."""
    if len(df) < 2:
        return []

    opens = df["open"].values
    highs = df["high"].values
    lows = df["low"].values
    closes = df["close"].values
    n = len(df)
    patterns: List[CandlestickPattern] = []

    for i in range(1, n):
        o_curr, h_curr, l_curr, c_curr = opens[i], highs[i], lows[i], closes[i]
        o_prev, h_prev, l_prev, c_prev = opens[i - 1], highs[i - 1], lows[i - 1], closes[i - 1]

        range_curr = h_curr - l_curr
        if range_curr <= 1e-6:
            continue

        body_curr = abs(c_curr - o_curr)
        body_prev = abs(c_prev - o_prev)

        # 1. Bullish Engulfing
        # Prev bar bearish, current bar bullish and body completely engulfs prev body
        if (
            c_prev < o_prev
            and c_curr > o_curr
            and o_curr <= c_prev
            and c_curr >= o_prev
            and body_curr > body_prev
        ):
            patterns.append(
                CandlestickPattern(
                    index=i,
                    pattern_type="BULLISH_ENGULFING",
                    price=float(c_curr),
                    time=df["time"].iloc[i] if "time" in df.columns else i,
                )
            )

        # 2. Bearish Engulfing
        # Prev bar bullish, current bar bearish and body completely engulfs prev body
        elif (
            c_prev > o_prev
            and c_curr < o_curr
            and o_curr >= c_prev
            and c_curr <= o_prev
            and body_curr > body_prev
        ):
            patterns.append(
                CandlestickPattern(
                    index=i,
                    pattern_type="BEARISH_ENGULFING",
                    price=float(c_curr),
                    time=df["time"].iloc[i] if "time" in df.columns else i,
                )
            )

        # 3. Bullish Pin Bar (Hammer)
        # Long lower wick >= 60% of candle range, body in upper 35%, minimal upper wick
        lower_wick = min(o_curr, c_curr) - l_curr
        upper_wick = h_curr - max(o_curr, c_curr)
        if (
            (lower_wick / range_curr >= 0.60)
            and (body_curr / range_curr <= 0.35)
            and (upper_wick / range_curr <= 0.15)
        ):
            patterns.append(
                CandlestickPattern(
                    index=i,
                    pattern_type="BULLISH_PIN_BAR",
                    price=float(c_curr),
                    time=df["time"].iloc[i] if "time" in df.columns else i,
                )
            )

        # 4. Bearish Pin Bar (Shooting Star)
        # Long upper wick >= 60% of candle range, body in lower 35%, minimal lower wick
        elif (
            (upper_wick / range_curr >= 0.60)
            and (body_curr / range_curr <= 0.35)
            and (lower_wick / range_curr <= 0.15)
        ):
            patterns.append(
                CandlestickPattern(
                    index=i,
                    pattern_type="BEARISH_PIN_BAR",
                    price=float(c_curr),
                    time=df["time"].iloc[i] if "time" in df.columns else i,
                )
            )

        # 5. Inside Bar
        # Current bar entirely within previous bar's high/low
        if h_curr <= h_prev and l_curr >= l_prev:
            patterns.append(
                CandlestickPattern(
                    index=i,
                    pattern_type="INSIDE_BAR",
                    price=float(c_curr),
                    time=df["time"].iloc[i] if "time" in df.columns else i,
                )
            )

    return patterns


def is_near_key_zone(
    price: float,
    levels: List[SRLevel],
    tolerance_pct: float = 0.005,
) -> Optional[SRLevel]:
    """Checks whether a given price is hovering within tolerance of an S/R level."""
    for lvl in levels:
        if abs(lvl.level - price) / lvl.level <= tolerance_pct:
            return lvl
    return None
