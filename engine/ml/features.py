"""Feature extraction pipeline for SignalDesk ML filter (Phase 4 Upgrade).

Extracts quantitative market setup features:
1. htf_alignment (binary)
2. volume_ratio (current bar vs 20-bar avg)
3. zone_size_atr (order block / FVG height relative to ATR)
4. distance_to_target_atr (distance to opposing liquidity level relative to ATR)
5. atr_pct (volatility as % of price)
6. time_of_day_minute (minutes elapsed from session open / UTC day start)
7. day_of_week (0=Mon to 6=Sun)
8. trend_strength (EMA 20 vs 50 spread normalized by ATR/volatility regime)
9. confluence_count (number of aligned independent conditions)
10. rr_planned (planned Risk-to-Reward ratio)
Extended features (when include_extended=True):
11. volatility_regime (current bar range / 20-bar ATR ratio)
12. recent_win_rate_context (rolling recent strategy win-rate context)
"""

from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

from engine.strategies.confluence import SetupCandidate


FEATURE_NAMES = [
    "htf_alignment",
    "volume_ratio",
    "zone_size_atr",
    "distance_to_target_atr",
    "atr_pct",
    "time_of_day_minute",
    "day_of_week",
    "trend_strength",
    "confluence_count",
    "rr_planned",
]

EXTENDED_FEATURE_NAMES = FEATURE_NAMES + [
    "volatility_regime",
    "recent_win_rate_context",
]


def compute_volatility_regime(entry_df: pd.DataFrame, atr: float) -> float:
    """Computes current spread/volatility regime (recent 5-bar range vs 20-bar ATR)."""
    if entry_df is None or len(entry_df) < 5 or atr <= 0:
        return 1.0
    recent_ranges = (entry_df["high"].iloc[-5:].astype(float) - entry_df["low"].iloc[-5:].astype(float)).mean()
    return round(float(recent_ranges / max(atr, 1e-9)), 3)


def extract_single_setup_features(
    candidate: SetupCandidate,
    entry_df: pd.DataFrame,
    asset_class: str = "equity",
    mode: str = "INTRADAY",
    recent_win_rate: float = 0.55,
    include_extended: bool = False,
) -> Dict[str, float]:
    """Extracts feature vector dict from a real-time or historical SetupCandidate."""
    cur_candle = entry_df.iloc[-1]
    cur_time = pd.to_datetime(cur_candle["time"]) if "time" in cur_candle else pd.Timestamp.now()
    cur_close = float(cur_candle["close"])
    min_atr = 0.0001 if cur_close < 1.0 else (0.001 if cur_close < 10.0 else 0.1)
    atr = max(min_atr, float(candidate.atr))

    # 1. HTF Alignment
    htf_align = 1.0 if (
        (candidate.side == "BUY" and candidate.htf_bias == "BULLISH")
        or (candidate.side == "SELL" and candidate.htf_bias == "BEARISH")
    ) else 0.0

    # 2. Volume Ratio
    vol_series = entry_df["volume"].astype(float)
    avg_vol = vol_series.iloc[-20:].mean() if len(vol_series) >= 20 else vol_series.mean()
    vol_ratio = float(vol_series.iloc[-1] / (avg_vol + 1e-9))

    # 3. Zone Size ATR
    zone_height = abs(candidate.ob_or_key_zone[1] - candidate.ob_or_key_zone[0])
    zone_size_atr = float(zone_height / atr)

    # 4. Distance to target ATR
    dist = abs(candidate.opposing_target_level - candidate.entry_price)
    dist_atr = float(dist / atr)

    # 5. ATR Pct
    atr_pct = float(atr / (cur_close + 1e-9) * 100.0)

    # 6. Time of Day
    minute_of_day = cur_time.hour * 60 + cur_time.minute
    if (asset_class or "equity").lower() == "crypto":
        minutes_from_open = float(minute_of_day)
    else:
        minutes_from_open = float(max(0, minute_of_day - (9 * 60 + 15)))

    # 7. Day of Week
    day_of_week = float(cur_time.weekday())

    # 8. Trend Strength (EMA20 vs EMA50 spread)
    if len(entry_df) >= 30:
        ema20 = entry_df["close"].ewm(span=20).mean().iloc[-1]
        ema50 = entry_df["close"].ewm(span=50).mean().iloc[-1]
        trend_strength = float((ema20 - ema50) / (cur_close + 1e-9) * 100.0)
    else:
        trend_strength = 0.0

    # 9. Confluence Count
    confluence_count = float(candidate.confluence_count)

    # 10. Planned RR
    risk = abs(candidate.entry_price - (candidate.ob_or_key_zone[0] - 0.5 * atr))
    reward = abs(candidate.opposing_target_level - candidate.entry_price)
    rr_planned = float(reward / (risk + 1e-9))

    base_features: Dict[str, float] = {
        "htf_alignment": htf_align,
        "volume_ratio": round(vol_ratio, 3),
        "zone_size_atr": round(zone_size_atr, 3),
        "distance_to_target_atr": round(dist_atr, 3),
        "atr_pct": round(atr_pct, 3),
        "time_of_day_minute": float(minutes_from_open),
        "day_of_week": day_of_week,
        "trend_strength": round(trend_strength, 3),
        "confluence_count": confluence_count,
        "rr_planned": round(rr_planned, 2),
    }

    if include_extended:
        base_features["volatility_regime"] = compute_volatility_regime(entry_df, atr)
        base_features["recent_win_rate_context"] = round(float(recent_win_rate), 3)

    return base_features


def build_training_dataset_from_trades(
    trades: List[Any],
    entry_df: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.Series]:
    """Generates feature matrix X and labels y (1=TP HIT net profitable, 0=SL HIT) from completed trades."""
    if not trades or entry_df.empty:
        return pd.DataFrame(columns=FEATURE_NAMES), pd.Series(dtype=int)

    entry_df = entry_df.set_index("time") if "time" in entry_df.columns else entry_df
    rows = []
    labels = []

    for t in trades:
        if t.status not in ("TP HIT", "SL HIT"):
            continue

        # Label includes fees and slippage: must be TP HIT and net PnL > 0
        is_win = 1 if (t.status == "TP HIT" and getattr(t, "pnl", 1.0) > 0) else 0

        if getattr(t, "features", None) and all(k in t.features for k in FEATURE_NAMES):
            rows.append({k: float(t.features[k]) for k in FEATURE_NAMES})
            labels.append(is_win)
            continue

        entry_t = t.entry_time
        try:
            sub_df = entry_df.loc[:entry_t] if isinstance(entry_df.index, pd.DatetimeIndex) else entry_df
            if len(sub_df) < 20:
                continue

            atr_val = max(0.0001, abs(t.entry_price - t.sl) / 1.5)
            dist_tp = abs(t.tp - t.entry_price)
            t_dt = pd.to_datetime(entry_t)

            row = {
                "htf_alignment": 1.0,
                "volume_ratio": 1.6,
                "zone_size_atr": 1.2,
                "distance_to_target_atr": dist_tp / (atr_val + 1e-6),
                "atr_pct": (atr_val / max(t.entry_price, 1e-6)) * 100.0,
                "time_of_day_minute": float(max(0, (t_dt.hour * 60 + t_dt.minute) - 555)),
                "day_of_week": float(t_dt.weekday()),
                "trend_strength": 0.5,
                "confluence_count": float(min(7, max(3, len(t.reasons)))),
                "rr_planned": float(t.rr_planned),
            }

            rows.append(row)
            labels.append(is_win)
        except Exception:
            continue

    X = pd.DataFrame(rows, columns=FEATURE_NAMES)
    y = pd.Series(labels, name="target")
    return X, y


def generate_synthetic_training_data(
    n_samples: int = 240,
    seed: int = 42,
) -> Tuple[pd.DataFrame, pd.Series]:
    """Generates structured chronological trade feature data for walk-forward ML testing and fallback training."""
    rng = np.random.default_rng(seed)
    rows: List[Dict[str, float]] = []
    labels: List[int] = []

    for i in range(n_samples):
        conf = float(rng.integers(3, 8))
        vol_ratio = float(np.round(rng.uniform(0.8, 2.8), 3))
        rr = float(np.round(rng.uniform(2.0, 3.6), 2))
        zone_atr = float(np.round(rng.uniform(0.4, 2.2), 3))
        trend_str = float(np.round(rng.uniform(-0.2, 1.5), 3))
        atr_pct = float(np.round(rng.uniform(0.3, 3.5), 3))

        # Higher confluence, strong volume expansion, tight zone, and trend alignment increase win odds
        score = (
            0.22 * (conf - 3.0)
            + 0.35 * (vol_ratio - 1.2)
            + 0.25 * trend_str
            - 0.20 * max(0.0, zone_atr - 1.3)
            + float(rng.normal(0.0, 0.35))
        )
        is_win = 1 if score > 0.25 else 0

        rows.append(
            {
                "htf_alignment": 1.0,
                "volume_ratio": vol_ratio,
                "zone_size_atr": zone_atr,
                "distance_to_target_atr": round(zone_atr * rr, 3),
                "atr_pct": atr_pct,
                "time_of_day_minute": float((i * 15) % 360),
                "day_of_week": float(i % 5),
                "trend_strength": trend_str,
                "confluence_count": conf,
                "rr_planned": rr,
            }
        )
        labels.append(is_win)

    return pd.DataFrame(rows, columns=FEATURE_NAMES), pd.Series(labels, name="target")

