"""Unit tests for Phase 2 (DataProvider abstraction + CCXT Crypto) and Phase 3 (Multi-asset Supabase cache).

All external API and database calls are mocked (zero real network requests).
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
import ccxt
import pandas as pd
import pytest

from engine.data.candle_cache import CandleCacheManager, is_candle_complete
from engine.data.providers import (
    AngelProvider,
    CcxtProvider,
    TRADE_TYPE_TIMEFRAMES,
    encode_symbol_doc_id,
    get_provider,
    map_to_canonical_interval,
    normalize_crypto_symbol,
)


def test_symbol_encoding_and_normalization():
    """Verify Firestore doc ID encoding and crypto symbol normalization."""
    assert encode_symbol_doc_id("BTC/USDT") == "BTC_USDT"
    assert encode_symbol_doc_id("tcs-eq") == "TCS-EQ"

    assert normalize_crypto_symbol("btcusdt") == "BTC/USDT"
    assert normalize_crypto_symbol("ETH_USDT") == "ETH/USDT"
    assert normalize_crypto_symbol("SOL-USDT") == "SOL/USDT"
    assert normalize_crypto_symbol("BTC/USDT") == "BTC/USDT"


def test_timeframe_and_trade_type_mappings():
    """Verify timeframe mappings for Equity (Intraday, Delivery) and Crypto (Scalp, Intraday, Swing)."""
    assert map_to_canonical_interval("FIVE_MINUTE") == "5m"
    assert map_to_canonical_interval("FIFTEEN_MINUTE") == "15m"
    assert map_to_canonical_interval("ONE_HOUR") == "1h"
    assert map_to_canonical_interval("4h") == "4h"
    assert map_to_canonical_interval("ONE_DAY") == "1d"
    assert map_to_canonical_interval("WEEKLY") == "1w"

    assert set(TRADE_TYPE_TIMEFRAMES["equity"].keys()) == {"INTRADAY", "DELIVERY"}
    assert set(TRADE_TYPE_TIMEFRAMES["crypto"].keys()) == {"SCALP", "INTRADAY", "SWING"}


def test_provider_factory_switching():
    """Verify get_provider returns AngelProvider for equity and CcxtProvider for crypto."""
    eq_prov = get_provider("equity")
    assert isinstance(eq_prov, AngelProvider)
    assert eq_prov.asset_class == "equity"

    cr_prov = get_provider("crypto", exchange="binance")
    assert isinstance(cr_prov, CcxtProvider)
    assert cr_prov.asset_class == "crypto"
    assert cr_prov.exchange_name == "BINANCE"


def test_angel_provider_search_and_candles():
    """Verify AngelProvider wraps AngelClient and tags results with assetClass='equity'."""
    mock_angel = MagicMock()
    mock_angel.search_symbols.return_value = [
        {"symbol": "TCS-EQ", "token": "11536", "name": "TCS", "exch_seg": "NSE"}
    ]
    sample_df = pd.DataFrame(
        {
            "time": [datetime(2025, 1, 1, 9, 15, tzinfo=timezone.utc)],
            "open": [3500.0],
            "high": [3520.0],
            "low": [3490.0],
            "close": [3510.0],
            "volume": [10000],
        }
    )
    mock_angel.get_candles.return_value = sample_df
    mock_angel.get_ltp.return_value = 3515.0

    provider = AngelProvider(angel_client=mock_angel)
    results = provider.search_symbols("TCS")
    assert len(results) == 1
    assert results[0]["assetClass"] == "equity"
    assert results[0]["exchange"] == "NSE"

    df = provider.get_candles("TCS-EQ", interval="5m", days=5)
    assert len(df) == 1
    mock_angel.get_candles.assert_called_once()

    price_info = provider.get_last_price("TCS-EQ", token="11536")
    assert price_info["ltp"] == 3515.0


def test_ccxt_provider_ohlcv_normalization_and_retry():
    """Verify CcxtProvider normalizes OHLCV to UTC DataFrame and retries on transient errors."""
    provider = CcxtProvider(exchange_id="binance")
    mock_ex = MagicMock()

    base_ms = int(datetime(2025, 1, 1, 0, 0, tzinfo=timezone.utc).timestamp() * 1000)
    raw_ohlcv = [
        [base_ms, 90000.0, 90500.0, 89800.0, 90200.0, 125.5],
        [base_ms + 300_000, 90200.0, 90800.0, 90100.0, 90700.0, 210.0],
    ]

    # First call raises RateLimitExceeded, second call succeeds
    mock_ex.fetch_ohlcv.side_effect = [
        ccxt.RateLimitExceeded("Rate limit"),
        raw_ohlcv,
    ]
    mock_ex.fetch_ticker.return_value = {"last": 90700.0, "percentage": 2.45}

    with patch.object(provider, "_get_exchange", return_value=mock_ex), \
         patch("engine.data.providers.time.sleep"):
        df = provider._fetch_direct_candles("BTC/USDT", interval="5m", days=1)
        assert len(df) == 2
        assert list(df.columns) == ["open", "high", "low", "close", "volume", "time"] or set(df.columns) == {
            "time",
            "open",
            "high",
            "low",
            "close",
            "volume",
        }
        assert float(df["close"].iloc[-1]) == 90700.0

        ticker = provider.get_last_price("BTC/USDT")
        assert ticker["ltp"] == 90700.0
        assert ticker["changePct"] == 2.45


def test_ccxt_provider_graceful_fallback_when_exchange_down():
    """Verify CcxtProvider never crashes when exchange throws ExchangeNotAvailable."""
    provider = CcxtProvider(exchange_id="binance")
    mock_ex = MagicMock()
    mock_ex.fetch_ohlcv.side_effect = ccxt.ExchangeNotAvailable("Exchange maintenance")
    mock_ex.load_markets.side_effect = ccxt.NetworkError("Offline")

    with patch.object(provider, "_get_exchange", return_value=mock_ex), \
         patch("engine.data.providers.time.sleep"):
        # Search falls back to curated DEFAULT_CRYPTO_PAIRS
        search_res = provider.search_symbols("BTC")
        assert len(search_res) >= 1
        assert search_res[0]["symbol"] == "BTC/USDT"
        assert search_res[0]["assetClass"] == "crypto"

        # Candle fetch returns empty DataFrame without raising exception
        df = provider._fetch_direct_candles("BTC/USDT", interval="1h", days=5)
        assert df.empty


def test_crypto_candle_completion_and_cache():
    """Verify is_candle_complete for 24/7 crypto timeframes and CandleCacheManager with provider."""
    now_utc = datetime.now(timezone.utc)
    closed_4h = now_utc - timedelta(hours=5)
    open_4h = now_utc - timedelta(hours=1)

    assert is_candle_complete(closed_4h, "4h", asset_class="crypto") is True
    assert is_candle_complete(open_4h, "4h", asset_class="crypto") is False

    provider = CcxtProvider(exchange_id="binance")
    sample_df = pd.DataFrame(
        {
            "time": [now_utc - timedelta(minutes=20), now_utc - timedelta(minutes=10)],
            "open": [3000.0, 3010.0],
            "high": [3020.0, 3030.0],
            "low": [2990.0, 3005.0],
            "close": [3010.0, 3025.0],
            "volume": [500.0, 600.0],
        }
    )

    with patch("engine.data.candle_cache.is_supabase_configured", return_value=True), \
         patch("engine.data.candle_cache.get_cached_candles", return_value=[]), \
         patch("engine.data.candle_cache.upsert_cached_candles") as mock_upsert, \
         patch.object(provider, "_fetch_direct_candles", return_value=sample_df):
        res_df = CandleCacheManager.get_candles_with_provider(
            provider=provider,
            symbol="ETH/USDT",
            interval="5m",
            days=1,
            asset_class="crypto",
            exchange="BINANCE",
        )
        assert len(res_df) == 2
        assert mock_upsert.call_count == 1
        upserted_rows = mock_upsert.call_args[0][0]
        assert upserted_rows[0]["asset_class"] == "crypto"
        assert upserted_rows[0]["exchange"] == "BINANCE"


def test_live_prices_only_write_when_ltp_changes():
    """Verify MarketScanner.update_live_prices skips duplicate LTP writes to Firestore."""
    from engine.scheduler.scanner import MarketScanner

    mock_crypto = MagicMock()
    mock_crypto.exchange_id = "binance"
    scanner = MarketScanner(crypto_provider=mock_crypto)

    watchlist_items = [
        {"symbol": "BTC/USDT", "assetClass": "crypto", "exchange": "BINANCE"}
    ]

    with patch("engine.scheduler.scanner.firebase_client.get_all_watchlists", return_value=watchlist_items), \
         patch("engine.scheduler.scanner.firebase_client.write_live_price") as mock_write:
        # First write for BTC/USDT at 65000.50 -> should write
        mock_crypto.get_last_price.return_value = {"ltp": 65000.50, "changePct": 1.5}
        scanner.update_live_prices()
        assert mock_write.call_count == 1

        # Second write with identical LTP -> should skip Firestore write
        scanner.update_live_prices()
        assert mock_write.call_count == 1

        # Third write with changed LTP -> should write to Firestore
        mock_crypto.get_last_price.return_value = {"ltp": 65120.75, "changePct": 1.7}
        scanner.update_live_prices()
        assert mock_write.call_count == 2


def test_multi_asset_tracker_crypto_24_7():
    """Verify SignalTracker monitors open crypto signals 24/7 with SL-first resolution."""
    from engine.tracker.live_tracker import SignalTracker

    mock_crypto_provider = MagicMock()
    mock_crypto_provider.exchange_id = "binance"
    now_utc = datetime.now(timezone.utc)
    # Candle touches both SL (2950) and TP (3150) -> SL must win under SL-first rule
    mock_crypto_provider.get_candles.return_value = pd.DataFrame(
        {
            "time": [now_utc],
            "open": [3000.0],
            "high": [3160.0],
            "low": [2940.0],
            "close": [3050.0],
            "volume": [1200.0],
        }
    )

    open_signals = [
        {
            "id": "sig_eth_1",
            "uid": "user_1",
            "symbol": "ETH/USDT",
            "assetClass": "crypto",
            "exchange": "BINANCE",
            "side": "BUY",
            "entry": 3000.0,
            "sl": 2950.0,
            "tp": 3150.0,
            "rr": 3.0,
            "tradeType": "SCALP",
            "status": "OPEN",
        }
    ]

    tracker = SignalTracker(crypto_provider=mock_crypto_provider)
    with patch("engine.tracker.live_tracker.firebase_client.get_open_signals", return_value=open_signals), \
         patch("engine.tracker.live_tracker.firebase_client.get_signal_outcome", return_value=None), \
         patch("engine.tracker.live_tracker.firebase_client.write_signal_outcome") as mock_write_fs, \
         patch("engine.db.supabase_client.upsert_signal_outcome") as mock_upsert_sb:
        resolved = tracker.run_tracking_cycle()
        assert len(resolved) == 1
        assert resolved[0]["status"] == "SL HIT"
        assert resolved[0]["exitPrice"] == 2950.0
        mock_write_fs.assert_called_once()
        assert mock_write_fs.call_args[0][1]["status"] == "SL HIT"
        mock_upsert_sb.assert_called_once()
        assert mock_upsert_sb.call_args[0][0]["assetClass"] == "crypto"


def test_api_crypto_symbol_search():
    """Verify /api/symbols/search?q=SOL&assetClass=crypto returns USDT pairs."""
    from fastapi.testclient import TestClient
    from engine.api.main import app

    client = TestClient(app)
    resp = client.get("/api/symbols/search?q=SOL&assetClass=crypto")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) >= 1
    assert any(r["symbol"] == "SOL/USDT" and r["assetClass"] == "crypto" for r in body)


def test_backtest_config_for_asset_class():
    """Verify per-asset fee/slippage configuration for equity vs crypto."""
    from engine.backtest.engine import BacktestConfig

    eq_cfg = BacktestConfig.for_asset_class("equity")
    assert eq_cfg.asset_class == "equity"
    assert eq_cfg.exchange == "NSE"
    assert eq_cfg.brokerage_pct == 0.0005

    cr_cfg = BacktestConfig.for_asset_class("crypto")
    assert cr_cfg.asset_class == "crypto"
    assert cr_cfg.exchange == "BINANCE"
    assert cr_cfg.brokerage_pct == 0.0010
    assert cr_cfg.initial_capital == 10000.0

