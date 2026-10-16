"""Firebase client module for SignalDesk.

Handles Firebase Admin SDK initialization, Firestore connection,
signal persistence, and user watchlist operations.
Never logs secrets or sensitive credentials.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import Client

from engine.data.config import settings

logger = logging.getLogger("signaldesk.firebase")

_firestore_client: Optional[Client] = None


def get_firestore_client() -> Client:
    """Initializes Firebase Admin SDK (singleton) and returns Firestore Client.

    Raises:
        FileNotFoundError: If serviceAccountKey.json is missing.
        Exception: If initialization fails.
    """
    global _firestore_client
    if _firestore_client is not None:
        return _firestore_client

    missing = settings.validate_firebase_credentials()
    if missing:
        raise FileNotFoundError(
            f"Missing required Firebase configuration file: {missing[0]}"
        )

    try:
        try:
            firebase_admin.get_app()
            logger.debug("Firebase Admin SDK already initialized.")
        except ValueError:
            cred = credentials.Certificate(str(settings.firebase_service_account_path))
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK successfully initialized.")

        _firestore_client = firestore.client()
        return _firestore_client
    except Exception as exc:
        logger.error(f"Failed to initialize Firestore client: {exc}")
        raise


def write_test_doc(
    collection_name: str = "test_connection",
    data: Optional[Dict[str, Any]] = None,
) -> str:
    """Writes a test document to Firestore to verify connectivity and write access."""
    db = get_firestore_client()
    if data is None:
        data = {
            "test": "SignalDesk connection test",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "OK",
        }
    doc_ref = db.collection(collection_name).document()
    doc_ref.set(data)
    logger.info(f"Test document written to {collection_name}/{doc_ref.id}")
    return doc_ref.id


def write_signal(signal_data: Dict[str, Any]) -> str:
    """Writes or creates a signal document in the 'signals' collection.

    Schema:
    signals/{id}:
        uid: str
        symbol: str
        tradeType: str ("INTRADAY" | "DELIVERY")
        side: str ("BUY" | "SELL")
        entry: float
        sl: float
        tp: float
        rr: float
        confidence: int (0-100)
        timeframes: Dict[str, str]
        reasons: List[str]
        status: str ("OPEN" | "TP HIT" | "SL HIT" | "CANCELLED")
        createdAt: str | datetime
        closedAt: Optional[str | datetime]
        exitPrice: Optional[float]
    """
    db = get_firestore_client()
    signal_id = signal_data.get("id")
    if not signal_id:
        doc_ref = db.collection("signals").document()
        signal_id = doc_ref.id
        signal_data["id"] = signal_id
    else:
        doc_ref = db.collection("signals").document(signal_id)

    if "createdAt" not in signal_data:
        signal_data["createdAt"] = datetime.now(timezone.utc).isoformat()
    if "status" not in signal_data:
        signal_data["status"] = "OPEN"

    doc_ref.set(signal_data, merge=True)
    logger.info(
        f"Signal written: {signal_id} for {signal_data.get('symbol')} ({signal_data.get('tradeType')})"
    )
    return signal_id


def update_signal_status(
    signal_id: str,
    status: str,
    exit_price: Optional[float] = None,
    closed_at: Optional[datetime] = None,
) -> bool:
    """Updates status and exit details for an existing signal (Legacy helper; outcomes should use write_signal_outcome)."""
    db = get_firestore_client()
    update_data: Dict[str, Any] = {"status": status}
    if exit_price is not None:
        update_data["exitPrice"] = exit_price
    if closed_at is not None:
        update_data["closedAt"] = closed_at.isoformat()
    else:
        update_data["closedAt"] = datetime.now(timezone.utc).isoformat()

    db.collection("signals").document(signal_id).update(update_data)
    logger.info(f"Signal {signal_id} updated to status {status}")
    return True


def write_signal_outcome(signal_id: str, outcome_data: Dict[str, Any]) -> str:
    """Stores trade outcome in 'signal_outcomes' next to the immutable signal record.
    CRITICAL: Does NOT modify the original 'signals/{signal_id}' document.
    """
    db = get_firestore_client()
    doc_ref = db.collection("signal_outcomes").document(signal_id)
    payload = dict(outcome_data)
    payload["signal_id"] = signal_id
    if "recorded_at" not in payload:
        payload["recorded_at"] = datetime.now(timezone.utc).isoformat()
    doc_ref.set(payload, merge=True)
    logger.info(
        f"Trade outcome recorded for {signal_id}: {payload.get('status')} ({payload.get('exit_reason')}) | Net R: {payload.get('net_r')}"
    )
    return signal_id


def get_signal_outcome(signal_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves the trade outcome for a specific signal ID."""
    db = get_firestore_client()
    doc = db.collection("signal_outcomes").document(signal_id).get()
    if doc.exists:
        d = doc.to_dict()
        d["id"] = doc.id
        return d
    return None


def get_all_signal_outcomes(limit: int = 100) -> List[Dict[str, Any]]:
    """Retrieves all tracked signal outcomes ordered by recorded_at descending."""
    db = get_firestore_client()
    query = (
        db.collection("signal_outcomes")
        .order_by("recorded_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )
    outcomes = []
    for doc in query.stream():
        d = doc.to_dict()
        d["id"] = doc.id
        outcomes.append(d)
    return outcomes


def get_open_signals() -> List[Dict[str, Any]]:
    """Retrieves all open signals across users."""
    db = get_firestore_client()
    docs = db.collection("signals").where("status", "==", "OPEN").stream()
    signals = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        signals.append(d)
    return signals


def get_user_signals(uid: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves recent signals for a specific user."""
    db = get_firestore_client()
    query = (
        db.collection("signals")
        .where("uid", "==", uid)
        .order_by("createdAt", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )
    signals = []
    for doc in query.stream():
        d = doc.to_dict()
        d["id"] = doc.id
        signals.append(d)
    return signals


def get_all_watchlists() -> List[Dict[str, Any]]:
    """Loads watchlists from all users using collection group query on 'watchlist'.

    Groups by unique (assetClass, exchange, symbol), aggregates required tradeTypes,
    and preserves subscriber uids.
    Returns:
    [
        {
            "symbol": "TCS-EQ",
            "token": "11536",
            "name": "TCS",
            "assetClass": "equity",
            "exchange": "NSE",
            "tradeTypes": ["intraday", "delivery"],
            "subscribers": [{"uid": "...", "tradeTypes": [...]}]
        },
        ...
    ]
    """
    db = get_firestore_client()
    symbol_map: Dict[str, Dict[str, Any]] = {}

    def _record_doc(w_doc: Any, fallback_uid: str = "") -> None:
        item = w_doc.to_dict() or {}
        sym = item.get("symbol", w_doc.id)
        token = item.get("token", "")
        asset_class = str(item.get("assetClass") or ("crypto" if "/" in str(sym) else "equity")).lower()
        exchange = str(item.get("exchange") or (settings.crypto_exchange.upper() if asset_class == "crypto" else "NSE")).upper()
        default_types = ["scalp", "intraday"] if asset_class == "crypto" else ["intraday", "delivery"]
        trade_types = item.get("tradeTypes", default_types)

        user_ref = getattr(getattr(w_doc, "reference", None), "parent", None)
        parent_doc = getattr(user_ref, "parent", None) if user_ref else None
        uid = fallback_uid or (parent_doc.id if parent_doc else item.get("uid", ""))

        if not uid or not sym:
            return

        group_key = f"{asset_class}:{exchange}:{sym}"
        if group_key not in symbol_map:
            symbol_map[group_key] = {
                "symbol": sym,
                "token": token,
                "name": item.get("name", sym),
                "assetClass": asset_class,
                "exchange": exchange,
                "tradeTypes": set(trade_types),
                "subscribers": [],
            }
        else:
            symbol_map[group_key]["tradeTypes"].update(trade_types)
            if not symbol_map[group_key]["token"] and token:
                symbol_map[group_key]["token"] = token

        symbol_map[group_key]["subscribers"].append(
            {"uid": uid, "tradeTypes": trade_types}
        )

    try:
        watchlist_docs = db.collection_group("watchlist").stream()
        for w_doc in watchlist_docs:
            _record_doc(w_doc)
    except Exception as exc:
        logger.warning(f"Collection group query on 'watchlist' fallback: {exc}")
        try:
            users_stream = db.collection("users").stream()
            for user_doc in users_stream:
                uid = user_doc.id
                sub_docs = db.collection("users").document(uid).collection("watchlist").stream()
                for w_doc in sub_docs:
                    _record_doc(w_doc, fallback_uid=uid)
        except Exception as inner_exc:
            logger.error(f"Fallback watchlist stream failed: {inner_exc}")

    result = []
    for _, data in symbol_map.items():
        data["tradeTypes"] = sorted(list(data["tradeTypes"]))
        result.append(data)
    return result


def verify_firebase_token(id_token: str) -> Dict[str, Any]:
    """Verifies Firebase ID token using Admin SDK and returns decoded claims including 'uid'."""
    if not id_token or len(id_token.split(".")) != 3:
        raise ValueError("Invalid Firebase ID token format (must be a 3-part signed JWT).")
    get_firestore_client()  # Assures Firebase Admin is initialized
    from firebase_admin import auth as admin_auth
    return admin_auth.verify_id_token(id_token)


def update_user_whatsapp_verified(uid: str, verified: bool = True) -> bool:
    """Updates whatsappVerified in users/{uid} doc (Admin SDK only)."""
    db = get_firestore_client()
    db.collection("users").document(uid).set(
        {
            "whatsappVerified": verified,
            "whatsappVerifiedAt": datetime.now(timezone.utc).isoformat(),
        },
        merge=True,
    )
    logger.info(f"Updated whatsappVerified={verified} for user {uid}")
    return True


def get_user_profile(uid: str) -> Optional[Dict[str, Any]]:
    """Retrieves user profile data from users/{uid}."""
    db = get_firestore_client()
    doc_snap = db.collection("users").document(uid).get()
    if doc_snap.exists:
        return doc_snap.to_dict()
    return None


def add_to_watchlist(
    uid: str,
    symbol: str,
    token: str,
    trade_types: List[str],
    asset_class: str = "equity",
    exchange: str = "NSE",
    name: Optional[str] = None,
) -> bool:
    """Adds or updates a symbol in a user's watchlist using encoded doc ID."""
    from engine.data.providers import encode_symbol_doc_id
    db = get_firestore_client()
    doc_id = encode_symbol_doc_id(symbol)
    db.collection("users").document(uid).collection("watchlist").document(doc_id).set(
        {
            "symbol": symbol,
            "token": token,
            "name": name or symbol,
            "assetClass": asset_class,
            "exchange": exchange,
            "tradeTypes": trade_types,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        },
        merge=True,
    )
    return True


def remove_from_watchlist(uid: str, symbol: str) -> bool:
    """Removes a symbol from user watchlist."""
    from engine.data.providers import encode_symbol_doc_id
    db = get_firestore_client()
    doc_id = encode_symbol_doc_id(symbol)
    db.collection("users").document(uid).collection("watchlist").document(doc_id).delete()
    return True


def write_live_price(
    symbol: str,
    ltp: float,
    change_pct: float,
    updated_at: Optional[str] = None,
    last_scan_at: Optional[str] = None,
    asset_class: str = "equity",
    exchange: str = "NSE",
) -> bool:
    """Writes latest live price snapshot for a symbol to livePrices/{symbolDocId}."""
    from engine.data.providers import encode_symbol_doc_id
    db = get_firestore_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    doc_id = encode_symbol_doc_id(symbol)
    decimals = 6 if float(ltp) < 1.0 else (4 if float(ltp) < 10.0 else 2)
    data = {
        "symbol": symbol,
        "assetClass": asset_class,
        "exchange": exchange,
        "ltp": round(float(ltp), decimals),
        "changePct": round(float(change_pct), 2),
        "updatedAt": updated_at or now_iso,
        "lastScanAt": last_scan_at or now_iso,
    }
    db.collection("livePrices").document(doc_id).set(data, merge=True)
    currency = "$" if asset_class == "crypto" else "₹"
    logger.debug(f"Updated live price for {symbol} ({doc_id}): {currency}{ltp} ({change_pct}%)")
    return True


def get_live_prices() -> Dict[str, Dict[str, Any]]:
    """Fetches all live price documents from livePrices collection."""
    db = get_firestore_client()
    prices: Dict[str, Dict[str, Any]] = {}
    docs = db.collection("livePrices").stream()
    for d in docs:
        prices[d.id] = d.to_dict()
    return prices


def write_engine_heartbeat(
    mode: str = "PAPER",
    version: str = "1.0.0",
    is_market_open: bool = False,
) -> bool:
    """Writes periodic engine heartbeat to engineStatus/main."""
    db = get_firestore_client()
    data = {
        "lastHeartbeat": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "version": version,
        "marketOpen": is_market_open,
    }
    db.collection("engineStatus").document("main").set(data, merge=True)
    logger.debug("Engine heartbeat written to engineStatus/main.")
    return True

