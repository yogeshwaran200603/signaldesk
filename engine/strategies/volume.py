"""Volume strategy module for SignalDesk.

Implements:
- VWAP (Volume-Weighted Average Price with session resets)
- Volume Spikes (vs 20-period moving average)
- Volume Profile: Point of Control (POC), Value Area High (VAH), Value Area Low (VAL)
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


@dataclass
class VolumeProfileResult:
    poc: float  # Point of Control
    vah: float  # Value Area High
    val: float  # Value Area Low
    total_volume: float
    bin_edges: List[float]
    bin_volumes: List[float]


def calculate_vwap(df: pd.DataFrame) -> pd.Series:
    """Calculates Volume Weighted Average Price (VWAP).

    For intraday series with 'time', resets VWAP at the start of each trading session.
    """
    if df.empty or "volume" not in df.columns:
        return pd.Series(dtype=float)

    typical_price = (df["high"] + df["low"] + df["close"]) / 3.0
    vol = df["volume"].astype(float)
    vol_price = typical_price * vol

    if "time" in df.columns:
        time_series = pd.to_datetime(df["time"])
        dates = time_series.dt.date
        vwap = vol_price.groupby(dates).cumsum() / vol.groupby(dates).cumsum()
    else:
        vwap = vol_price.cumsum() / vol.cumsum()

    # Fill potential 0-division NaNs
    return vwap.replace([np.inf, -np.inf], np.nan).ffill().bfill()


def detect_volume_spikes(
    df: pd.DataFrame, lookback: int = 20, threshold: float = 1.5
) -> pd.DataFrame:
    """Detects candles where volume significantly exceeds the rolling average.

    Args:
        df: DataFrame with 'volume' column
        lookback: Moving average period (default: 20)
        threshold: Multiplier threshold (e.g. 1.5x average)

    Returns:
        DataFrame with columns: ['vol_ma', 'vol_ratio', 'is_volume_spike']
    """
    if df.empty or "volume" not in df.columns:
        return pd.DataFrame(
            {"vol_ma": [], "vol_ratio": [], "is_volume_spike": []}
        )

    vol = df["volume"].astype(float)
    vol_ma = vol.rolling(window=lookback, min_periods=1).mean()
    vol_ratio = vol / (vol_ma + 1e-9)
    is_spike = vol_ratio >= threshold

    return pd.DataFrame(
        {
            "vol_ma": vol_ma,
            "vol_ratio": vol_ratio,
            "is_volume_spike": is_spike,
        },
        index=df.index,
    )


def calculate_volume_profile(
    df: pd.DataFrame, bins: int = 30, value_area_pct: float = 0.70
) -> VolumeProfileResult:
    """Calculates Volume Profile: Point of Control (POC), Value Area High (VAH), and Low (VAL).

    Distributes each bar's volume across overlapping price bins spanning its [low, high].
    """
    if len(df) == 0:
        return VolumeProfileResult(0.0, 0.0, 0.0, 0.0, [], [])

    price_min = float(df["low"].min())
    price_max = float(df["high"].max())

    if price_max <= price_min:
        return VolumeProfileResult(price_min, price_min, price_min, float(df["volume"].sum()), [price_min], [0.0])

    bin_edges = np.linspace(price_min, price_max, bins + 1)
    bin_volumes = np.zeros(bins)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2.0

    lows = df["low"].values
    highs = df["high"].values
    vols = df["volume"].values

    # Distribute candle volume across intersected bins
    for low, high, vol in zip(lows, highs, vols):
        if vol <= 0:
            continue
        # Find which bins intersect [low, high]
        intersect_mask = (bin_edges[1:] >= low) & (bin_edges[:-1] <= high)
        num_intersect = np.count_nonzero(intersect_mask)
        if num_intersect > 0:
            bin_volumes[intersect_mask] += vol / num_intersect
        else:
            # Fallback to closest bin center
            closest_idx = int(np.argmin(np.abs(bin_centers - (low + high) / 2.0)))
            bin_volumes[closest_idx] += vol

    # Point of Control (POC): bin with maximum volume
    poc_idx = int(np.argmax(bin_volumes))
    poc = float(bin_centers[poc_idx])

    # Calculate Value Area (enclosing value_area_pct of total volume)
    total_volume = float(np.sum(bin_volumes))
    target_volume = total_volume * value_area_pct

    included_indices = {poc_idx}
    accumulated_volume = bin_volumes[poc_idx]

    left = poc_idx - 1
    right = poc_idx + 1

    while accumulated_volume < target_volume and (left >= 0 or right < bins):
        left_vol = bin_volumes[left] if left >= 0 else -1
        right_vol = bin_volumes[right] if right < bins else -1

        if left_vol >= right_vol and left >= 0:
            accumulated_volume += left_vol
            included_indices.add(left)
            left -= 1
        elif right < bins:
            accumulated_volume += right_vol
            included_indices.add(right)
            right += 1
        elif left >= 0:
            accumulated_volume += left_vol
            included_indices.add(left)
            left -= 1
        else:
            break

    val = float(bin_edges[min(included_indices)])
    vah = float(bin_edges[max(included_indices) + 1])

    return VolumeProfileResult(
        poc=poc,
        vah=vah,
        val=val,
        total_volume=total_volume,
        bin_edges=bin_edges.tolist(),
        bin_volumes=bin_volumes.tolist(),
    )
