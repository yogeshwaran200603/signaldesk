"""Unit tests for Stage 4: Tracker, Scheduler, Notifier, and API.

All network calls and external API endpoints are mocked.
"""

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from engine.api.main import app
from engine.notifier.factory import get_notifier
from engine.notifier.log_fallback import LogNotifier
from engine.notifier.whatsapp import WhatsAppCloudNotifier
from engine.tracker.live_tracker import SignalTracker
from engine.scheduler.scanner import MarketScanner


client = TestClient(app)


# ----------------- NOTIFIER TESTS -----------------

def test_log_notifier_fallback():
    """Verify LogNotifier runs cleanly without throwing errors."""
    notifier = LogNotifier()
    signal_data = {
        "symbol": "TCS-EQ",
        "tradeType": "INTRADAY",
        "side": "BUY",
        "entry": 2090.0,
        "sl": 2070.0,
        "tp": 2140.0,
        "rr": 2.5,
        "confidence": 85,
    }
    assert notifier.send_signal_alert(signal_data, "+919876543210") is True
    assert notifier.send_test_message("+919876543210") is True


def test_whatsapp_cloud_formatting_and_mock_send():
    """Verify WhatsApp message formatting and request payload."""
    wn = WhatsAppCloudNotifier(phone_number_id="123456", access_token="mock_token")
    assert wn.is_configured() is True

    signal_data = {
        "symbol": "IDEA-EQ",
        "tradeType": "INTRADAY",
        "side": "BUY",
        "entry": 13.5,
        "sl": 13.0,
        "tp": 14.8,
        "rr": 2.6,
        "confidence": 80,
        "reasons": ["Liquidity sweep", "Bullish CHoCH"],
    }
    msg = wn.format_signal_message(signal_data)
    assert "IDEA-EQ" in msg
    assert "₹13.50" in msg
    assert "Not financial advice" in msg

    # Mock HTTP post
    with patch("engine.notifier.whatsapp.requests.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_post.return_value = mock_resp

        res = wn.send_signal_alert(signal_data, "+919876543210")
        assert res is True
        mock_post.assert_called_once()


# ----------------- TRACKER TESTS -----------------

def test_live_tracker_sl_first_conflict():
    """Verify live tracker enforces SL-first resolution if candle touches both."""
    tracker = SignalTracker()

    buy_sig = {
        "id": "SIG_1",
        "symbol": "TCS-EQ",
        "side": "BUY",
        "entry": 100.0,
        "sl": 95.0,
        "tp": 110.0,
    }

    # Candle touches both TP (112) and SL (92)
    res = tracker.check_signal_against_candle(buy_sig, candle_high=112.0, candle_low=92.0)
    assert res is not None
    status, exit_price = res
    assert status == "SL HIT"
    assert exit_price == 95.0

    # Normal TP touch (high 111, low 98)
    res_tp = tracker.check_signal_against_candle(buy_sig, candle_high=111.0, candle_low=98.0)
    assert res_tp == ("TP HIT", 110.0)


def test_live_tracker_sell_side():
    """Verify live tracker for SELL side."""
    tracker = SignalTracker()

    sell_sig = {
        "id": "SIG_2",
        "symbol": "TCS-EQ",
        "side": "SELL",
        "entry": 100.0,
        "sl": 105.0,
        "tp": 90.0,
    }

    # Normal TP touch
    res_tp = tracker.check_signal_against_candle(sell_sig, candle_high=102.0, candle_low=89.0)
    assert res_tp == ("TP HIT", 90.0)

    # Normal SL touch
    res_sl = tracker.check_signal_against_candle(sell_sig, candle_high=106.0, candle_low=95.0)
    assert res_sl == ("SL HIT", 105.0)


# ----------------- SCANNER TESTS -----------------

def test_scanner_deduplication():
    """Verify de-duplication prevents duplicate alerts within 60 minutes."""
    scanner = MarketScanner()

    # First attempt: not duplicate
    is_dup1 = scanner._is_duplicate("TCS-EQ", "INTRADAY", "BUY", 2090.0)
    assert is_dup1 is False

    # Second attempt immediately: duplicate!
    is_dup2 = scanner._is_duplicate("TCS-EQ", "INTRADAY", "BUY", 2091.0)
    assert is_dup2 is True

    # Different symbol: not duplicate
    is_dup3 = scanner._is_duplicate("IDEA-EQ", "INTRADAY", "BUY", 13.5)
    assert is_dup3 is False


# ----------------- FASTAPI ENDPOINTS TESTS -----------------

def test_api_health_endpoint():
    """Verify /api/health endpoint returns structured operational status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert "paper_mode" in data
    assert "services" in data
    assert "Not financial advice" in data["disclaimer"]


def test_api_symbols_search_endpoint():
    """Verify /api/symbols/search returns scrip matches."""
    with patch("engine.data.angel_client.AngelClient.search_symbols") as mock_search:
        mock_search.return_value = [{"symbol": "TCS-EQ", "name": "TCS", "token": "11536"}]
        response = client.get("/api/symbols/search?q=TCS")
        assert response.status_code == 200
        items = response.json()
        assert len(items) >= 1
        assert items[0]["symbol"] == "TCS-EQ"


def test_api_send_test_whatsapp_endpoint():
    """Verify /api/alerts/send-test triggers verification message."""
    response = client.post("/api/alerts/send-test", json={"recipient": "+919876543210"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
