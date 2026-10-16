"""Unit tests for the RejectedSignalTracker and counterfactual simulation."""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import pandas as pd
import pytest

from engine.tracker.rejected_logger import RejectedSignalTracker


@pytest.fixture
def temp_tracker(tmp_path):
    cache_path = tmp_path / "test_rejected.jsonl"
    return RejectedSignalTracker(cache_file=cache_path)


def test_log_rejected_candidate_and_simulate_tp(temp_tracker):
    """Verifies that a candidate rejected by ML is logged and forward simulated to TP."""
    record = temp_tracker.log_rejected_candidate(
        symbol="RELIANCE",
        side="BUY",
        entry_price=2500.0,
        sl=2450.0,
        tp=2600.0,
        rr=2.0,
        features={"confluence_count": 6, "volume_ratio": 1.4},
        ml_prob=0.52,
        ml_threshold=0.65,
        ml_model_used="xgb_filter_equity_intraday",
        rejection_reason="ML probability 0.52 below gate threshold 0.65",
        asset_class="equity",
        exchange="NSE",
        mode="INTRADAY",
    )

    assert record.id.startswith("rej_")
    assert record.counterfactual_status == "PENDING"
    assert record.ml_probability == 0.52

    # Simulate future candles that reach 2605 (TP)
    base_t = datetime(2026, 10, 8, 4, 0, tzinfo=timezone.utc)
    future_bars = pd.DataFrame(
        [
            {"time": (base_t + timedelta(minutes=5)).isoformat(), "high": 2540.0, "low": 2490.0, "close": 2530.0},
            {"time": (base_t + timedelta(minutes=10)).isoformat(), "high": 2605.0, "low": 2520.0, "close": 2595.0},
        ]
    )

    updated = temp_tracker.simulate_counterfactual_outcome(record, future_bars)
    assert updated.counterfactual_status == "TP HIT"
    assert updated.counterfactual_exit_price == 2600.0
    assert updated.counterfactual_exit_reason == "TARGET_REACHED"
    assert updated.counterfactual_gross_r is not None
    assert updated.counterfactual_gross_r > 1.5

    # Check retrieve
    recent = temp_tracker.get_recent_rejected()
    assert len(recent) == 1
    assert recent[0]["id"] == record.id
