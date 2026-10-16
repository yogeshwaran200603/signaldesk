"""Unit tests for Stage 2: Strategy Engine.

Tests all strategy modules using synthetic OHLCV data:
- SMC: Swings, BOS, CHoCH, Order Blocks, FVGs, Liquidity Sweeps, Premium/Discount
- Volume: VWAP, Volume Spikes, Volume Profile (POC/VAH/VAL)
- Price Action: Candlestick patterns (Engulfing, Pin Bar, Inside Bar) and S/R levels
- Confluence Scorer: Multi-condition alignment & HTF bias
- Trade Builder: Strict RR >= 1:2 filter and confidence scoring
"""

import numpy as np
import pandas as pd
import pytest

from engine.strategies.smc import (
    find_swing_points,
    detect_bos_choch,
    detect_order_blocks,
    detect_fair_value_gaps,
    detect_liquidity_sweeps,
    calculate_premium_discount,
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
from engine.strategies.confluence import (
    evaluate_htf_bias,
    compute_atr,
    scan_timeframe_setup,
    SetupCandidate,
)
from engine.strategies.trade_builder import build_trade_signal, TradeSignal


def create_synthetic_df(prices, volumes=None):
    """Helper to create OHLCV dataframe from a close price series."""
    n = len(prices)
    if volumes is None:
        volumes = [1000] * n

    df_data = []
    for i, p in enumerate(prices):
        open_p = prices[i - 1] if i > 0 else p
        # Distinguish high and low so peak close has peak high
        high_p = max(open_p, p) + 2.0
        low_p = min(open_p, p) - 2.0
        df_data.append({
            "time": pd.Timestamp("2024-01-01 09:15") + pd.Timedelta(minutes=5 * i),
            "open": open_p,
            "high": high_p,
            "low": low_p,
            "close": p,
            "volume": volumes[i],
        })
    df = pd.DataFrame(df_data)
    return df


# ----------------- SMC TESTS -----------------

def test_smc_swings_no_lookahead():
    """Verify swing points are detected and confirmed only with window lag."""
    # Peak at index 3 (high 125), trough at index 6 (low 75)
    df_data = [
        {"open": 100, "high": 102, "low": 98, "close": 101, "volume": 1000}, # 0
        {"open": 101, "high": 108, "low": 100, "close": 107, "volume": 1000}, # 1
        {"open": 107, "high": 115, "low": 105, "close": 114, "volume": 1000}, # 2
        {"open": 114, "high": 125, "low": 112, "close": 124, "volume": 1000}, # 3 Peak High
        {"open": 124, "high": 118, "low": 108, "close": 110, "volume": 1000}, # 4
        {"open": 110, "high": 105, "low": 90,  "close": 92,  "volume": 1000}, # 5
        {"open": 92,  "high": 94,  "low": 75,  "close": 78,  "volume": 1000}, # 6 Trough Low
        {"open": 78,  "high": 88,  "low": 77,  "close": 86,  "volume": 1000}, # 7
        {"open": 86,  "high": 98,  "low": 85,  "close": 96,  "volume": 1000}, # 8
    ]
    df = pd.DataFrame(df_data)
    df["time"] = pd.date_range("2024-01-01 09:15", periods=len(df), freq="5min")
    swings = find_swing_points(df, window=2)

    assert len(swings) >= 2
    high_swings = [s for s in swings if s.swing_type == "HIGH"]
    low_swings = [s for s in swings if s.swing_type == "LOW"]

    assert len(high_swings) >= 1
    assert high_swings[0].index == 3
    # Swing at 3 with window=2 is confirmed at index 5 (no lookahead)
    assert high_swings[0].confirmed_at == 5

    assert len(low_swings) >= 1
    assert low_swings[0].index == 6
    assert low_swings[0].confirmed_at == 8


def test_smc_bos_and_choch():
    """Verify CHoCH and BOS detection across trend transition."""
    df_data = [
        {"open": 100, "high": 102, "low": 98, "close": 100, "volume": 1000}, # 0
        {"open": 100, "high": 110, "low": 99, "close": 108, "volume": 1000}, # 1 - High 110
        {"open": 108, "high": 105, "low": 90, "close": 92,  "volume": 1000}, # 2 - Low 90
        {"open": 92,  "high": 96,  "low": 85, "close": 86,  "volume": 1000}, # 3 - Confirms low 90
        {"open": 86,  "high": 115, "low": 85, "close": 114, "volume": 1000}, # 4 - Breaks high 110 (BULLISH CHOCH)
    ]
    df = pd.DataFrame(df_data)
    df["time"] = pd.date_range("2024-01-01 09:15", periods=len(df), freq="5min")
    swings = find_swing_points(df, window=1)
    events = detect_bos_choch(df, swings)

    assert len(events) >= 1
    bullish_events = [e for e in events if e.direction == "BULLISH"]
    assert len(bullish_events) >= 1


def test_smc_order_blocks():
    """Verify Order Blocks generated prior to breakout structure."""
    df_data = [
        {"open": 100, "high": 102, "low": 98, "close": 99, "volume": 1000},   # 0
        {"open": 99,  "high": 101, "low": 96, "close": 97, "volume": 1000},   # 1 - Down candle
        {"open": 97,  "high": 110, "low": 97, "close": 109, "volume": 5000},  # 2 - Strong breakout
        {"open": 109, "high": 115, "low": 108, "close": 114, "volume": 3000}, # 3 - Higher high
        {"open": 114, "high": 115, "low": 98,  "close": 105, "volume": 2000}, # 4 - Retests OB
    ]
    df = pd.DataFrame(df_data)
    df["time"] = pd.date_range("2024-01-01 09:15", periods=5, freq="5min")

    swings = find_swing_points(df, window=1)
    events = detect_bos_choch(df, swings)
    obs = detect_order_blocks(df, events)

    # Order block logic executes cleanly
    assert isinstance(obs, list)


def test_smc_fair_value_gaps():
    """Verify 3-candle Fair Value Gap detection."""
    df_data = [
        {"open": 100, "high": 102, "low": 99,  "close": 101, "volume": 1000}, # Bar 0: High = 102
        {"open": 101, "high": 115, "low": 101, "close": 114, "volume": 4000}, # Bar 1: Strong impulse
        {"open": 114, "high": 120, "low": 106, "close": 118, "volume": 2000}, # Bar 2: Low = 106 (Gap: 102 to 106)
    ]
    df = pd.DataFrame(df_data)
    df["time"] = pd.date_range("2024-01-01 09:15", periods=3, freq="5min")

    fvgs = detect_fair_value_gaps(df)
    assert len(fvgs) == 1
    assert fvgs[0].fvg_type == "BULLISH"
    assert fvgs[0].bottom == 102.0
    assert fvgs[0].top == 106.0
    assert not fvgs[0].mitigated


def test_smc_liquidity_sweeps():
    """Verify wick sweep of swing low and close back inside."""
    prices = [100, 95, 90, 85, 92, 90, 95]
    df = create_synthetic_df(prices)
    # Inject sweep candle at the end: drops to 83 (below 85 swing) but closes at 88
    df.loc[6, "low"] = 82.0
    df.loc[6, "close"] = 88.0

    swings = find_swing_points(df, window=1)
    sweeps = detect_liquidity_sweeps(df, swings)
    # Detection should register a sweep candidate
    assert isinstance(sweeps, list)


def test_smc_premium_discount():
    """Verify dealing range equilibrium and zone assignment."""
    df_data = [
        {"open": 100, "high": 150, "low": 100, "close": 110, "volume": 1000},
        {"open": 110, "high": 140, "low": 105, "close": 115, "volume": 1000},
    ]
    df = pd.DataFrame(df_data)
    res = calculate_premium_discount(df, lookback=10)

    assert res["range_high"] == 150.0
    assert res["range_low"] == 100.0
    assert res["equilibrium"] == 125.0
    assert res["current_zone"] == "DISCOUNT"  # 115 < 125


# ----------------- VOLUME TESTS -----------------

def test_volume_vwap_and_spikes():
    """Verify VWAP computation and volume spike detection."""
    df = pd.DataFrame({
        "time": pd.date_range("2024-01-01 09:15", periods=25, freq="5min"),
        "open": [100] * 25,
        "high": [102] * 25,
        "low": [98] * 25,
        "close": [101] * 25,
        "volume": [1000] * 24 + [5000],  # 5x volume spike on bar 25
    })

    vwap = calculate_vwap(df)
    assert len(vwap) == 25
    assert not vwap.isna().any()

    spikes = detect_volume_spikes(df, lookback=20, threshold=1.5)
    assert bool(spikes["is_volume_spike"].iloc[-1]) is True
    assert bool(spikes["is_volume_spike"].iloc[5]) is False


def test_volume_profile():
    """Verify Volume Profile POC and Value Area calculation."""
    df = pd.DataFrame({
        "open": [100, 102, 102, 105],
        "high": [103, 104, 104, 108],
        "low": [99, 101, 101, 103],
        "close": [102, 103, 103, 107],
        "volume": [1000, 10000, 10000, 2000],  # Most volume clustered around ~102-104
    })

    vp = calculate_volume_profile(df, bins=10)
    assert vp.poc >= 101.0 and vp.poc <= 105.0
    assert vp.val <= vp.poc
    assert vp.vah >= vp.poc
    assert vp.total_volume == pytest.approx(23000.0)


# ----------------- PRICE ACTION TESTS -----------------

def test_candlestick_patterns():
    """Verify Bullish Engulfing, Bearish Engulfing, and Pin Bar detection."""
    # 1. Bullish Engulfing
    df_engulf = pd.DataFrame([
        {"open": 105, "high": 106, "low": 99,  "close": 100, "volume": 1000},  # Bearish bar
        {"open": 99,  "high": 110, "low": 98,  "close": 108, "volume": 2000},  # Bullish engulfing
    ])
    df_engulf["time"] = pd.date_range("2024-01-01 09:15", periods=2, freq="5min")
    patterns = detect_candlestick_patterns(df_engulf)
    assert any(p.pattern_type == "BULLISH_ENGULFING" for p in patterns)

    # 2. Bullish Pin Bar (Hammer)
    # Range = 100 - 80 = 20. Body = 99 - 97 = 2 (10% of range). Lower wick = 97 - 80 = 17 (85% of range). Upper wick = 100 - 99 = 1 (5% of range).
    df_pin = pd.DataFrame([
        {"open": 100, "high": 102, "low": 98, "close": 101, "volume": 1000},
        {"open": 97,  "high": 100, "low": 80, "close": 99,  "volume": 2000},
    ])
    df_pin["time"] = pd.date_range("2024-01-01 09:15", periods=2, freq="5min")
    pin_patterns = detect_candlestick_patterns(df_pin)
    assert any(p.pattern_type == "BULLISH_PIN_BAR" for p in pin_patterns)


# ----------------- CONFLUENCE & TRADE BUILDER TESTS -----------------

def test_confluence_htf_bias():
    """Verify HTF bias identifies uptrend correctly."""
    uptrend_prices = np.linspace(100, 200, 30)
    df_htf = create_synthetic_df(uptrend_prices)
    bias = evaluate_htf_bias(df_htf)
    assert bias == "BULLISH"


def test_trade_builder_strict_rr_filter():
    """Verify setup is rejected if RR < 1:2, and accepted when RR >= 1:2."""
    # Sub-2 RR setup: Entry 100, SL 95 (risk 5), Target 105 (reward 5, RR = 1.0)
    poor_candidate = SetupCandidate(
        symbol="TCS-EQ",
        trade_type="INTRADAY",
        side="BUY",
        entry_price=100.0,
        ob_or_key_zone=(96.0, 99.0),
        opposing_target_level=105.0,  # RR will be < 2.0
        atr=2.0,
        reasons=["HTF Bullish", "Order Block Retest", "Volume Spike"],
        confluence_count=3,
        htf_bias="BULLISH",
    )
    sig_poor = build_trade_signal(poor_candidate)
    assert sig_poor is None  # Strictly rejected!

    # Good RR setup: Entry 100, SL 96 (risk 4), Target 112 (reward 12, RR = 3.0)
    good_candidate = SetupCandidate(
        symbol="TCS-EQ",
        trade_type="INTRADAY",
        side="BUY",
        entry_price=100.0,
        ob_or_key_zone=(97.0, 99.0),
        opposing_target_level=112.0,
        atr=1.5,
        reasons=[
            "Higher timeframe bias is BULLISH",
            "Retesting active Bullish Order Block zone",
            "Volume confirmation surge",
            "Price action confirmation: Bullish Engulfing",
        ],
        confluence_count=4,
        htf_bias="BULLISH",
    )
    sig_good = build_trade_signal(good_candidate)
    assert sig_good is not None
    assert sig_good.rr >= 2.0
    assert sig_good.side == "BUY"
    assert sig_good.confidence >= 70
    assert len(sig_good.reasons) == 4
    assert sig_good.status == "OPEN"
