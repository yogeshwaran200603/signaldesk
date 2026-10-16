"""Unit tests for Stage 1: Data layer (AngelClient and FirebaseClient).

All external network and API calls are mocked.
"""

import json
from unittest.mock import MagicMock, patch
import pandas as pd
import pytest

from engine.data.angel_client import AngelClient, INTERVAL_WEEKLY, INTERVAL_FIVE_MINUTE
from engine.data.config import Settings


def test_settings_secret_protection():
    """Verify secrets are not exposed in repr or string conversions."""
    s = Settings(
        angel_api_key="secret_key_123",
        angel_client_id="CLI123",
        angel_pin="1234",
        angel_totp_secret="TOTPSECRET",
    )
    rep = repr(s)
    assert "secret_key_123" not in rep
    assert "1234" not in rep
    assert "TOTPSECRET" not in rep
    assert "CLI123" not in rep  # masked as ***


def test_angel_client_scrip_master_lookup(tmp_path):
    """Verify symbol token lookup and normalization."""
    dummy_scrip_data = [
        {
            "token": "11536",
            "symbol": "TCS-EQ",
            "name": "TCS",
            "exch_seg": "NSE",
            "tick_size": "5.0",
            "lotsize": "1",
        },
        {
            "token": "14366",
            "symbol": "IDEA-EQ",
            "name": "IDEA",
            "exch_seg": "NSE",
            "tick_size": "5.0",
            "lotsize": "1",
        },
        {
            "token": "19329",
            "symbol": "OLAELEC-EQ",
            "name": "OLAELEC",
            "exch_seg": "NSE",
            "tick_size": "5.0",
            "lotsize": "1",
        },
    ]

    cache_file = tmp_path / "OpenAPIScripMaster.json"
    cache_file.write_text(json.dumps(dummy_scrip_data), encoding="utf-8")

    client = AngelClient()
    client.scrip_cache_file = cache_file
    client.load_scrip_master(force_refresh=False)

    # Test symbol lookup variations
    tcs = client.get_token_for_symbol("TCS")
    assert tcs is not None
    assert tcs["token"] == "11536"
    assert tcs["symbol"] == "TCS-EQ"

    tcs_eq = client.get_token_for_symbol("TCS-EQ")
    assert tcs_eq is not None
    assert tcs_eq["token"] == "11536"

    idea = client.get_token_for_symbol("IDEA")
    assert idea is not None
    assert idea["token"] == "14366"

    ola = client.get_token_for_symbol("olaelec")
    assert ola is not None
    assert ola["token"] == "19329"

    # Search symbol
    res = client.search_symbols("tc")
    assert len(res) >= 1
    assert res[0]["symbol"] == "TCS-EQ"


def test_angel_client_login_mock():
    """Verify login handles TOTP generation and session data."""
    with patch("engine.data.angel_client.SmartConnect") as mock_smart_conn, \
         patch("engine.data.angel_client.pyotp.TOTP") as mock_totp:

        mock_totp_instance = MagicMock()
        mock_totp_instance.now.return_value = "123456"
        mock_totp.return_value = mock_totp_instance

        mock_api_instance = MagicMock()
        mock_api_instance.generateSession.return_value = {
            "status": True,
            "data": {
                "jwtToken": "mock_jwt",
                "refreshToken": "mock_refresh",
                "feedToken": "mock_feed",
            },
        }
        mock_smart_conn.return_value = mock_api_instance

        client = AngelClient()
        client.api_key = "test_key"
        client.client_id = "test_cli"
        client.pin = "test_pin"
        client.totp_secret = "test_totp"

        success = client.login()
        assert success is True
        assert client.jwt_token == "mock_jwt"
        mock_api_instance.generateSession.assert_called_once()


def test_angel_client_get_candles_mock(tmp_path):
    """Verify candle data fetching, parsing, and formatting."""
    client = AngelClient()
    client._scrip_map = {
        "TCS": {"token": "11536", "symbol": "TCS-EQ", "name": "TCS", "exch_seg": "NSE"},
        "TCS-EQ": {"token": "11536", "symbol": "TCS-EQ", "name": "TCS", "exch_seg": "NSE"},
    }
    client._scrip_loaded = True

    mock_candles = [
        ["2024-03-01 09:15", 3800.0, 3820.0, 3795.0, 3810.0, 1000],
        ["2024-03-01 09:20", 3810.0, 3815.0, 3805.0, 3812.0, 800],
    ]

    with patch.object(client, "_execute_candle_request", return_value=mock_candles):
        df = client.get_candles("TCS", interval=INTERVAL_FIVE_MINUTE, days=2)
        assert not df.empty
        assert list(df.columns) == ["time", "open", "high", "low", "close", "volume"]
        assert len(df) == 2
        assert df.iloc[0]["open"] == 3800.0
        assert df.iloc[1]["close"] == 3812.0


def test_weekly_resampling():
    """Verify weekly resampling aggregates OHLCV correctly."""
    dates = pd.date_range("2024-01-01", periods=10, freq="D")
    df = pd.DataFrame({
        "time": dates,
        "open": [10, 12, 11, 13, 14, 15, 16, 17, 18, 19],
        "high": [15, 14, 13, 16, 17, 18, 19, 20, 21, 22],
        "low":  [9,  11, 10, 12, 13, 14, 15, 16, 17, 18],
        "close":[12, 11, 13, 14, 15, 16, 17, 18, 19, 20],
        "volume":[100] * 10,
    })

    weekly_df = AngelClient._resample_weekly(df)
    assert not weekly_df.empty
    assert "time" in weekly_df.columns
    assert "open" in weekly_df.columns
    assert "high" in weekly_df.columns
    assert "low" in weekly_df.columns
    assert "close" in weekly_df.columns
    assert "volume" in weekly_df.columns
    # Check volume aggregation
    assert weekly_df["volume"].iloc[0] > 100


def test_firebase_client_operations():
    """Verify Firestore operations formatting and helpers."""
    from engine.data import firebase_client

    mock_db = MagicMock()
    mock_doc_ref = MagicMock()
    mock_doc_ref.id = "mock_signal_id_123"
    mock_db.collection.return_value.document.return_value = mock_doc_ref

    with patch.object(firebase_client, "get_firestore_client", return_value=mock_db):
        signal_data = {
            "symbol": "TCS-EQ",
            "tradeType": "INTRADAY",
            "side": "BUY",
            "entry": 3800.0,
            "sl": 3780.0,
            "tp": 3850.0,
            "rr": 2.5,
            "confidence": 85,
        }
        res_id = firebase_client.write_signal(signal_data)
        assert res_id == "mock_signal_id_123"
        mock_doc_ref.set.assert_called_once()

        updated = firebase_client.update_signal_status(res_id, "TP HIT", exit_price=3850.0)
        assert updated is True
        mock_doc_ref.update.assert_called_once()
