"""Unit tests for Stage 6: Machine Learning Filter.

Tests:
- Setup candidate feature extraction
- XGBoost filter training & inference
- Fallback behavior when model is absent
"""

import pandas as pd
import pytest

from engine.ml.features import (
    FEATURE_NAMES,
    extract_single_setup_features,
)
from engine.ml.model import SignalMLFilter, load_trained_model
from engine.strategies.confluence import SetupCandidate


def test_feature_names_and_extraction():
    """Verify all 10 quantitative features are extracted cleanly."""
    candidate = SetupCandidate(
        symbol="TCS-EQ",
        trade_type="INTRADAY",
        side="BUY",
        entry_price=2100.0,
        ob_or_key_zone=(2085.0, 2095.0),
        opposing_target_level=2150.0,
        atr=10.0,
        reasons=["HTF Bullish", "Liquidity sweep", "Order block retest"],
        confluence_count=3,
        htf_bias="BULLISH",
    )

    df_data = []
    base_time = pd.Timestamp("2024-01-01 09:15")
    for i in range(25):
        df_data.append({
            "time": base_time + pd.Timedelta(minutes=5 * i),
            "open": 2090.0,
            "high": 2105.0,
            "low": 2085.0,
            "close": 2100.0,
            "volume": 5000,
        })
    df = pd.DataFrame(df_data)

    features = extract_single_setup_features(candidate, df)
    assert len(features) == 10
    for name in FEATURE_NAMES:
        assert name in features
        assert isinstance(features[name], (int, float))

    assert features["htf_alignment"] == 1.0
    assert features["confluence_count"] == 3.0


def test_ml_filter_inference():
    """Verify ML filter model can load and produce probability score."""
    model = load_trained_model()
    if model is not None:
        sample_features = {
            "htf_alignment": 1.0,
            "volume_ratio": 1.8,
            "zone_size_atr": 1.0,
            "distance_to_target_atr": 4.5,
            "atr_pct": 0.45,
            "time_of_day_minute": 60.0,
            "day_of_week": 1.0,
            "trend_strength": 0.5,
            "confluence_count": 4.0,
            "rr_planned": 2.5,
        }
        prob = model.predict_win_probability(sample_features)
        assert 0.0 <= prob <= 1.0
    else:
        # Graceful fallback test
        filter_empty = SignalMLFilter(model=None)
        prob = filter_empty.predict_win_probability({})
        assert prob == 1.0  # Pass through when model is missing
