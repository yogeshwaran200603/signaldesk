"""Connection test script for SignalDesk.

Tests:
1. Angel One SmartAPI Login (Client ID + PIN + fresh TOTP)
2. ScripMaster download/lookup for target stocks (TCS, IDEA, OLAELEC)
3. Historical candle data fetching for TCS, IDEA, OLAELEC
4. Firebase Admin SDK initialization & Firestore write capability

Never prints secrets or tokens.
"""

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine.data.config import settings
from engine.data.angel_client import AngelClient, INTERVAL_FIVE_MINUTE, INTERVAL_ONE_DAY
from engine.data.firebase_client import get_firestore_client, write_test_doc


def test_angel_connection() -> bool:
    print("=" * 60)
    print("TEST 1: ANGEL ONE SMARTAPI CONNECTION")
    print("=" * 60)

    # 1. Check credentials
    missing = settings.validate_angel_credentials()
    if missing:
        print(f"[FAIL] Missing Angel One environment variables: {', '.join(missing)}")
        return False

    client = AngelClient()

    # 2. Test Login
    try:
        logged_in = client.login()
        if logged_in:
            print("[OK] Angel One Authentication & TOTP Generation")
        else:
            print("[FAIL] Angel One Authentication returned False")
            return False
    except Exception as exc:
        print(f"[FAIL] Angel One Authentication error: {exc}")
        return False

    # 3. Test ScripMaster lookup
    try:
        client.load_scrip_master()
        stocks_to_test = ["TCS", "IDEA", "OLAELEC"]
        lookup_success = True
        for sym in stocks_to_test:
            token_info = client.get_token_for_symbol(sym)
            if token_info:
                print(f"[OK] Symbol lookup '{sym}' -> {token_info['symbol']} (token: {token_info['token']})")
            else:
                print(f"[FAIL] Symbol lookup failed for '{sym}'")
                lookup_success = False

        if not lookup_success:
            return False
    except Exception as exc:
        print(f"[FAIL] ScripMaster lookup error: {exc}")
        return False

    # 4. Test Candle Fetching
    candle_success = True
    for sym in stocks_to_test:
        try:
            # Fetch 5 days of 5-minute candles
            df = client.get_candles(sym, interval=INTERVAL_FIVE_MINUTE, days=5)
            if not df.empty and len(df) > 0:
                latest_time = df.iloc[-1]["time"]
                latest_close = df.iloc[-1]["close"]
                print(f"[OK] Fetched {len(df)} candles for {sym} (Latest bar: {latest_time}, Close: {latest_close})")
            else:
                # If market closed or weekend, fallback to 15 days of 1-day candles to verify data flow
                df_daily = client.get_candles(sym, interval=INTERVAL_ONE_DAY, days=15)
                if not df_daily.empty:
                    print(f"[OK] Fetched {len(df_daily)} daily candles for {sym}")
                else:
                    print(f"[FAIL] Empty candle data returned for {sym}")
                    candle_success = False
        except Exception as exc:
            print(f"[FAIL] Candle fetch error for {sym}: {exc}")
            candle_success = False

    return candle_success


def test_firebase_connection() -> bool:
    print("\n" + "=" * 60)
    print("TEST 2: FIREBASE FIRESTORE CONNECTION")
    print("=" * 60)

    # 1. Check credentials
    missing = settings.validate_firebase_credentials()
    if missing:
        print(f"[FAIL] Missing Firebase credentials file: {', '.join(missing)}")
        return False

    # 2. Test Firestore Client Init & Write
    try:
        db = get_firestore_client()
        print(f"[OK] Firebase Admin SDK Initialized (Project: {db.project})")

        test_payload = {
            "test": "SignalDesk Stage 1 Connection Verification",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "HEALTHY",
            "verified_services": ["AngelOne", "Firestore"],
        }
        doc_id = write_test_doc(collection_name="connection_tests", data=test_payload)
        print(f"[OK] Firestore Write Verified (Document ID: {doc_id})")

        # Verify read back
        doc_snap = db.collection("connection_tests").document(doc_id).get()
        if doc_snap.exists:
            print("[OK] Firestore Read Verified")
            return True
        else:
            print("[FAIL] Written document could not be read back")
            return False

    except Exception as exc:
        print(f"[FAIL] Firebase Firestore error: {exc}")
        return False


def main():
    print("============================================================")
    print("      SIGNALDESK - STAGE 1 CONNECTION VERIFICATION          ")
    print("============================================================\n")

    angel_ok = test_angel_connection()
    firebase_ok = test_firebase_connection()

    print("\n" + "=" * 60)
    print("STAGE 1 TEST SUMMARY")
    print("=" * 60)
    print(f"Angel One SmartAPI Data Layer: {'[PASSED]' if angel_ok else '[FAILED]'}")
    print(f"Firebase Firestore Database:  {'[PASSED]' if firebase_ok else '[FAILED]'}")

    if angel_ok and firebase_ok:
        print("\nALL STAGE 1 CONNECTIONS PASSED SUCCESSFULLY!")
        sys.exit(0)
    else:
        print("\nONE OR MORE STAGE 1 CONNECTIONS FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
