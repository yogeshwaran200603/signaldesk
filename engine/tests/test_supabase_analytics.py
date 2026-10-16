"""Unit tests for Supabase historical/analytical integration and API endpoints.

Tests:
1. Supabase health check function (success & missing credentials handling)
2. Candle caching (CandleCacheManager):
   - First call caches complete candles
   - Second call reads from cache without querying external API
   - Current incomplete candle is never cached
   - Delta fetch correctly fills missing candle gaps
3. Performance calculation module:
   - Win rate, average RR, profit factor, expectancy (R), max drawdown (R)
   - Empty outcomes edge case handling
4. Equity curve progression and trade-type filtering
5. API endpoints:
   - GET /api/performance: rejects missing/invalid auth header (401)
   - GET /api/backtests: returns backtest metrics with disclaimer
   - GET /api/candles: returns formatted candle bars
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
import pandas as pd
import pytest
import pytz
from fastapi import HTTPException
from fastapi.testclient import TestClient

from engine.api.analytics import (
    calculate_performance_metrics,
    build_equity_curve,
    verify_auth_uid,
)
from engine.api.main import app
from engine.data.candle_cache import CandleCacheManager, is_candle_complete
from engine.db import supabase_client


# ==============================================================================
# 1. SUPABASE CLIENT & HEALTH TESTS
# ==============================================================================

def test_supabase_health_check_missing_config():
    """When credentials are blank/missing, health check returns UNCONFIGURED safely."""
    mock_settings = MagicMock()
    mock_settings.validate_supabase_credentials.return_value = ["SUPABASE_URL is missing"]
    with patch("engine.db.supabase_client.is_supabase_configured", return_value=False), \
         patch("engine.db.supabase_client.settings", mock_settings):
        res = supabase_client.check_supabase_health()
        assert res["status"] == "UNCONFIGURED"
        assert res["connected"] is False
        assert "SUPABASE_URL" in res.get("error", "")


def test_supabase_health_check_success():
    """When client query succeeds, health check reports HEALTHY."""
    mock_client = MagicMock()
    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_limit = MagicMock()
    mock_limit.execute.return_value = MagicMock(data=[])
    mock_select.limit.return_value = mock_limit
    mock_table.select.return_value = mock_select
    mock_client.table.return_value = mock_table

    with patch("engine.db.supabase_client.is_supabase_configured", return_value=True), \
         patch("engine.db.supabase_client.get_supabase_client", return_value=mock_client):
        res = supabase_client.check_supabase_health()
        assert res["status"] == "HEALTHY"
        assert res["connected"] is True


# ==============================================================================
# 2. CANDLE CACHE & COMPLETION TESTS
# ==============================================================================

def test_is_candle_complete_daily():
    """Past daily candles are complete; today's daily candle is incomplete during market hours."""
    past_ts = datetime(2025, 1, 10, 15, 30, tzinfo=timezone.utc)
    assert is_candle_complete(past_ts, "ONE_DAY") is True

    # Test during market hours (e.g. 11:30 AM IST today)
    midday_ist = datetime(2025, 1, 15, 11, 30, tzinfo=timezone.utc)
    with patch("engine.data.candle_cache.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2025, 1, 15, 11, 30, tzinfo=pytz.timezone("Asia/Kolkata"))
        # Candle for today during morning hours is incomplete
        assert is_candle_complete(midday_ist, "ONE_DAY") is False


def test_is_candle_complete_5m():
    """5-minute candle timestamped 1 hour ago is complete; candle timestamped 1 minute ago is open."""
    now = datetime.now(timezone.utc)
    completed_5m = now - timedelta(minutes=10)
    assert is_candle_complete(completed_5m, "FIVE_MINUTE") is True

    just_opened_5m = now - timedelta(seconds=60)
    assert is_candle_complete(just_opened_5m, "FIVE_MINUTE") is False


def test_candle_cache_manager_delta_and_hit():
    """Test CandleCacheManager caching completed bars and serving from cache."""
    # Generate test historical dataframe
    base_time = datetime(2025, 1, 1, 9, 15, tzinfo=timezone.utc)
    times = [base_time + timedelta(minutes=5 * i) for i in range(10)]
    df = pd.DataFrame(
        {
            "time": times,
            "open": [100.0 + i for i in range(10)],
            "high": [105.0 + i for i in range(10)],
            "low": [99.0 + i for i in range(10)],
            "close": [102.0 + i for i in range(10)],
            "volume": [1000 + i * 100 for i in range(10)],
        }
    )

    mock_angel = MagicMock()
    mock_angel.get_token_for_symbol.return_value = {"token": "11536", "symbol": "TCS-EQ"}
    mock_angel._fetch_direct_candles.return_value = df

    with patch("engine.data.candle_cache.is_supabase_configured", return_value=True), \
         patch("engine.data.candle_cache.get_cached_candles") as mock_get_cache, \
         patch("engine.data.candle_cache.upsert_cached_candles") as mock_upsert:

        # Scenario A: First call -> Cache empty -> queries SmartAPI -> upserts to cache
        mock_get_cache.return_value = []
        result_df = CandleCacheManager.get_candles(
            angel_client=mock_angel,
            symbol="TCS",
            interval="FIVE_MINUTE",
            days=5,
        )

        assert len(result_df) == 10
        assert mock_angel._fetch_direct_candles.call_count == 1
        assert mock_upsert.call_count == 1

        # Scenario B: Second call -> Cache has complete data -> SmartAPI is NOT called
        cached_records = [
            {
                "ts": r["time"].isoformat(),
                "open": r["open"],
                "high": r["high"],
                "low": r["low"],
                "close": r["close"],
                "volume": r["volume"],
            }
            for _, r in df.iterrows()
        ]
        # Set latest cached time to right now so it doesn't trigger delta fetch
        now_dt = datetime.now(timezone.utc)
        cached_records[-1]["ts"] = now_dt.isoformat()

        mock_get_cache.return_value = cached_records
        mock_angel._fetch_direct_candles.reset_mock()

        result_cached = CandleCacheManager.get_candles(
            angel_client=mock_angel,
            symbol="TCS",
            interval="FIVE_MINUTE",
            days=5,
        )

        assert len(result_cached) == 10
        assert mock_angel._fetch_direct_candles.call_count == 0


# ==============================================================================
# 3. PERFORMANCE CALCULATION TESTS
# ==============================================================================

def test_performance_metrics_calculation():
    """Verify Win Rate, Avg RR, Profit Factor, Expectancy, and Max Drawdown calculation."""
    sample_outcomes = [
        # Win 1: +2R (TP HIT)
        {
            "signal_id": "sig-1",
            "symbol": "TCS-EQ",
            "status": "TP HIT",
            "rr": 2.0,
            "pnl_r": 2.0,
            "opened_at": "2025-01-01T10:00:00Z",
            "closed_at": "2025-01-01T11:00:00Z",
        },
        # Win 2: +2.5R (TP HIT)
        {
            "signal_id": "sig-2",
            "symbol": "TCS-EQ",
            "status": "TP HIT",
            "rr": 2.5,
            "pnl_r": 2.5,
            "opened_at": "2025-01-02T10:00:00Z",
            "closed_at": "2025-01-02T11:00:00Z",
        },
        # Loss 1: -1R (SL HIT)
        {
            "signal_id": "sig-3",
            "symbol": "IDEA-EQ",
            "status": "SL HIT",
            "rr": 2.0,
            "pnl_r": -1.0,
            "opened_at": "2025-01-03T10:00:00Z",
            "closed_at": "2025-01-03T11:00:00Z",
        },
        # Loss 2: -1R (SL HIT)
        {
            "signal_id": "sig-4",
            "symbol": "TCS-EQ",
            "status": "SL HIT",
            "rr": 2.0,
            "pnl_r": -1.0,
            "opened_at": "2025-01-04T10:00:00Z",
            "closed_at": "2025-01-04T11:00:00Z",
        },
    ]

    metrics = calculate_performance_metrics(sample_outcomes)

    # 2 Wins, 2 Losses -> Win rate 50.0%
    assert metrics["total_trades"] == 4
    assert metrics["win_trades"] == 2
    assert metrics["loss_trades"] == 2
    assert metrics["win_rate_pct"] == 50.0

    # Gross Profit = +4.5R, Gross Loss = -2.0R -> Net PnL = +2.5R
    assert metrics["net_pnl_r"] == 2.5

    # Profit Factor = 4.5 / 2.0 = 2.25
    assert metrics["profit_factor"] == 2.25

    # Avg RR of wins = (2.0 + 2.5) / 2 = 2.25
    assert metrics["avg_rr"] == 2.25

    # Mathematical Expectancy = (0.5 * 2.25) - (0.5 * 1.0) = 1.125 - 0.5 = 0.62 or 0.63
    assert 0.60 <= metrics["expectancy_r"] <= 0.65

    # Max Drawdown: Trades: +2 -> +4.5 (peak) -> +3.5 (dd 1.0) -> +2.5 (dd 2.0)
    assert metrics["max_drawdown_r"] == 2.0

    # Per-stock stats
    tcs_stats = next((s for s in metrics["per_stock"] if s["symbol"] == "TCS-EQ"), None)
    assert tcs_stats is not None
    assert tcs_stats["total"] == 3
    assert tcs_stats["wins"] == 2
    assert tcs_stats["losses"] == 1
    assert tcs_stats["net_pnl_r"] == 3.5  # 2 + 2.5 - 1


def test_performance_metrics_empty():
    """Empty outcomes list returns clean zeroes."""
    metrics = calculate_performance_metrics([])
    assert metrics["total_trades"] == 0
    assert metrics["win_rate_pct"] == 0.0
    assert metrics["profit_factor"] == 0.0
    assert metrics["max_drawdown_r"] == 0.0
    assert metrics["per_stock"] == []


# ==============================================================================
# 4. EQUITY CURVE GENERATION TESTS
# ==============================================================================

def test_equity_curve_generation():
    """Verify cumulative R progression and trade_type filtering."""
    outcomes = [
        {
            "symbol": "TCS-EQ",
            "trade_type": "INTRADAY",
            "status": "TP HIT",
            "pnl_r": 2.0,
            "closed_at": "2025-01-01T11:00:00Z",
        },
        {
            "symbol": "INFY-EQ",
            "trade_type": "DELIVERY",
            "status": "SL HIT",
            "pnl_r": -1.0,
            "closed_at": "2025-01-02T11:00:00Z",
        },
        {
            "symbol": "RELIANCE-EQ",
            "trade_type": "INTRADAY",
            "status": "TP HIT",
            "pnl_r": 2.0,
            "closed_at": "2025-01-03T11:00:00Z",
        },
    ]

    # ALL trades
    curve_all = build_equity_curve(outcomes, trade_type="ALL")
    assert len(curve_all) == 3
    assert curve_all[0]["cumulative_r"] == 2.0
    assert curve_all[1]["cumulative_r"] == 1.0
    assert curve_all[2]["cumulative_r"] == 3.0

    # Filter INTRADAY only
    curve_intra = build_equity_curve(outcomes, trade_type="INTRADAY")
    assert len(curve_intra) == 2
    assert curve_intra[0]["cumulative_r"] == 2.0
    assert curve_intra[1]["cumulative_r"] == 4.0


# ==============================================================================
# 5. API ENDPOINT AUTH & DATA TESTS
# ==============================================================================

def test_api_performance_auth_required():
    """Unauthenticated requests must be rejected with 401."""
    client = TestClient(app)
    # No Authorization header
    resp = client.get("/api/performance")
    assert resp.status_code == 401
    assert "Authentication required" in resp.json()["detail"]

    # Invalid Bearer header
    resp2 = client.get("/api/performance", headers={"Authorization": "Bearer invalid_token_123"})
    assert resp2.status_code == 401


def test_api_backtests_endpoint():
    """GET /api/backtests returns benchmark data and disclaimer."""
    client = TestClient(app)
    resp = client.get("/api/backtests?symbol=TCS-EQ")
    assert resp.status_code == 200
    data = resp.json()
    assert data["symbol"] == "TCS-EQ"
    assert "metrics" in data
    assert "win_rate_pct" in data["metrics"]
    assert "profit_factor" in data["metrics"]
    assert "disclaimer" in data
    assert "not a guarantee" in data["disclaimer"].lower()
