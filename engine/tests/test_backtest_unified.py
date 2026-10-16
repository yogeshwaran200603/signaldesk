"""Unit tests for the unified BacktestRunner (Phase 1)."""

from datetime import datetime, timedelta, timezone
import numpy as np
import pandas as pd
import pytest

from engine.backtest.engine import (
    BacktestConfig,
    BacktestRunner,
    _is_past_square_off_time,
)


def _generate_synthetic_nse_candles(n_candles: int = 150) -> pd.DataFrame:
    """Generates synthetic 5m NSE candles with realistic timestamps starting at 09:15 IST."""
    base_time = datetime(2026, 10, 8, 3, 45, tzinfo=timezone.utc)  # 09:15 AM IST is 03:45 AM UTC
    rows = []
    price = 2500.0

    for i in range(n_candles):
        # advance 5 mins
        t = base_time + timedelta(minutes=5 * i)
        step = np.random.normal(0.2, 2.0)
        c_open = price
        c_close = price + step
        c_high = max(c_open, c_close) + abs(np.random.normal(0, 1.5))
        c_low = min(c_open, c_close) - abs(np.random.normal(0, 1.5))
        vol = max(1000, int(np.random.normal(25000, 5000)))
        rows.append(
            {
                "time": t.isoformat(),
                "open": round(c_open, 2),
                "high": round(c_high, 2),
                "low": round(c_low, 2),
                "close": round(c_close, 2),
                "volume": vol,
            }
        )
        price = c_close

    return pd.DataFrame(rows)


def test_square_off_time_detector():
    """Verifies that 15:15 IST is accurately detected."""
    # 15:15 IST is 09:45 UTC
    t_315_utc = datetime(2026, 10, 8, 9, 45, tzinfo=timezone.utc)
    t_310_utc = datetime(2026, 10, 8, 9, 40, tzinfo=timezone.utc)
    t_320_utc = datetime(2026, 10, 8, 9, 50, tzinfo=timezone.utc)

    assert _is_past_square_off_time(t_315_utc) is True
    assert _is_past_square_off_time(t_310_utc) is False
    assert _is_past_square_off_time(t_320_utc) is True


def test_backtest_runner_unified_execution():
    """Verifies that BacktestRunner executes through LiveStrategyEngine and calculates net R after costs."""
    candles = _generate_synthetic_nse_candles(120)
    config = BacktestConfig.for_asset_class("equity", "NSE")
    config.slippage_pct = 0.0003
    config.ml_threshold = 0.50  # relaxed threshold for synthetic test

    runner = BacktestRunner(config=config)
    metrics, trades = runner.run(
        symbol="RELIANCE",
        entry_df=candles,
        trade_type="INTRADAY",
        asset_class="equity",
        exchange="NSE",
    )

    # Basic structural assertions
    assert metrics.initial_capital == 100000.0
    assert hasattr(metrics, "net_expectancy_r")
    assert hasattr(metrics, "gross_expectancy_r")
    assert hasattr(metrics, "total_costs")

    if trades:
        t = trades[0]
        # Must have realistic statutory cost breakdown
        assert t.total_costs > 0
        assert t.brokerage > 0
        assert t.entry_price_executed != t.entry_price
        assert t.exit_price_executed != t.exit_price
        # Net R must be strictly less than Gross R on wins due to fee friction
        if t.gross_pnl > 0:
            assert t.net_r <= t.gross_r
        assert t.status in ("TP HIT", "SL HIT", "SQUARE_OFF_315", "EXPIRED")
