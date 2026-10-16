"""Log-only fallback Notifier for SignalDesk.

Allows the entire pipeline to function continuously even when external WhatsApp
credentials are not yet configured.
"""

import logging
from typing import Any, Dict
from engine.notifier.base import BaseNotifier

logger = logging.getLogger("signaldesk.notifier.log")


class LogNotifier(BaseNotifier):
    """Fallback notifier that logs trading alerts to standard application logs."""

    def send_signal_alert(self, signal_data: Dict[str, Any], recipient: str) -> bool:
        masked_recipient = f"{recipient[:4]}****{recipient[-2:]}" if len(recipient) >= 6 else "***"
        sym = signal_data.get("symbol", "")
        asset_class = str(signal_data.get("assetClass") or ("crypto" if "/" in str(sym) else "equity")).lower()
        exchange = str(signal_data.get("exchange") or ("BINANCE" if asset_class == "crypto" else "NSE")).upper()
        curr = "$" if asset_class == "crypto" else "₹"
        logger.info(
            f"[ALERT DISPATCHED (LOG MODE)] To: {masked_recipient} | "
            f"Symbol: {sym} [{asset_class.upper()}·{exchange}] | "
            f"Type: {signal_data.get('tradeType')} | "
            f"Side: {signal_data.get('side')} | "
            f"Entry: {curr}{signal_data.get('entry')} | "
            f"SL: {curr}{signal_data.get('sl')} | "
            f"TP: {curr}{signal_data.get('tp')} | "
            f"RR: 1:{signal_data.get('rr')} | "
            f"Confidence: {signal_data.get('confidence')}%"
        )
        return True

    def send_test_message(self, recipient: str) -> bool:
        masked_recipient = f"{recipient[:4]}****{recipient[-2:]}" if len(recipient) >= 6 else "***"
        logger.info(f"[TEST MESSAGE (LOG MODE)] Sent test verification to {masked_recipient}")
        return True
