"""Unit tests for SignalTracker and immutable outcome storage."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
import pytest

from engine.tracker.live_tracker import SignalTracker


@pytest.fixture
def mock_tracker():
    angel_mock = MagicMock()
    crypto_mock = MagicMock()
    return SignalTracker(angel_client=angel_mock, crypto_provider=crypto_mock)


def test_outcome_tracker_tp_hit(mock_tracker):
    """Verifies that an open BUY signal reaching target is marked as TP HIT."""
    signal = {
        "id": "sig_buy_1",
        "symbol": "TCS",
        "side": "BUY",
        "entry": 3500.0,
        "sl": 3450.0,
        "tp": 3600.0,
        "tradeType": "INTRADAY",
        "assetClass": "equity",
    }
    # High reaches 3610 (above 3600 TP), Low is 3480 (above 3450 SL)
    res = mock_tracker.check_signal_against_candle(
        signal=signal,
        candle_high=3610.0,
        candle_low=3480.0,
        candle_close=3590.0,
        candle_time=datetime(2026, 10, 8, 5, 0, tzinfo=timezone.utc),  # 10:30 AM IST
    )
    assert res is not None
    status, exit_price, reason = res
    assert status == "TP HIT"
    assert exit_price == 3600.0
    assert reason == "TARGET_REACHED"


def test_outcome_tracker_sl_first_conflict(mock_tracker):
    """Verifies that if both SL and TP are touched in the same candle, SL is counted first."""
    signal = {
        "id": "sig_buy_2",
        "symbol": "INFY",
        "side": "BUY",
        "entry": 1800.0,
        "sl": 1780.0,
        "tp": 1840.0,
        "tradeType": "INTRADAY",
        "assetClass": "equity",
    }
    # Wide candle touches both SL (1775 <= 1780) and TP (1850 >= 1840)
    res = mock_tracker.check_signal_against_candle(
        signal=signal,
        candle_high=1850.0,
        candle_low=1775.0,
        candle_close=1810.0,
        candle_time=datetime(2026, 10, 8, 6, 0, tzinfo=timezone.utc),
    )
    assert res is not None
    status, exit_price, reason = res
    assert status == "SL HIT"
    assert exit_price == 1780.0
    assert reason == "STOP_LOSS_HIT"


def test_outcome_tracker_315_square_off(mock_tracker):
    """Verifies that an open intraday trade at 15:15 IST (09:45 UTC) is forcefully squared off at candle close."""
    signal = {
        "id": "sig_buy_3",
        "symbol": "RELIANCE",
        "side": "BUY",
        "entry": 2500.0,
        "sl": 2450.0,
        "tp": 2600.0,
        "tradeType": "INTRADAY",
        "assetClass": "equity",
    }
    # Time is 09:45 UTC = 15:15 IST
    t_315_utc = datetime(2026, 10, 8, 9, 45, tzinfo=timezone.utc)
    res = mock_tracker.check_signal_against_candle(
        signal=signal,
        candle_high=2530.0,
        candle_low=2510.0,
        candle_close=2525.0,
        candle_time=t_315_utc,
    )
    assert res is not None
    status, exit_price, reason = res
    assert status == "SQUARE_OFF_315"
    assert exit_price == 2525.0
    assert reason == "INTRADAY_SQUARE_OFF_315"


def test_immutable_signal_outcome_storage():
    """Verifies that write_signal_outcome writes to signal_outcomes and never touches the original signals collection."""
    from engine.data import firebase_client

    mock_db = MagicMock()
    mock_outcomes_col = MagicMock()
    mock_doc = MagicMock()
    mock_db.collection.return_value = mock_outcomes_col
    mock_outcomes_col.document.return_value = mock_doc

    with patch.object(firebase_client, "get_firestore_client", return_value=mock_db):
        outcome_data = {
            "symbol": "TCS",
            "status": "TP HIT",
            "exit_reason": "TARGET_REACHED",
            "net_r": 1.92,
            "total_costs": 142.50,
        }
        res_id = firebase_client.write_signal_outcome("test_sig_123", outcome_data)

        assert res_id == "test_sig_123"
        # Collection accessed must be 'signal_outcomes', NOT 'signals'
        mock_db.collection.assert_called_with("signal_outcomes")
        mock_outcomes_col.document.assert_called_with("test_sig_123")
        mock_doc.set.assert_called_once()
        saved_call = mock_doc.set.call_args[0][0]
        assert saved_call["status"] == "TP HIT"
        assert saved_call["signal_id"] == "test_sig_123"
