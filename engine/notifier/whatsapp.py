"""Meta WhatsApp Cloud API Notifier for SignalDesk.

Delivers formatted trade alerts via official Meta WhatsApp Business API.
Never logs access tokens or secrets.
"""

import logging
import re
from typing import Any, Dict, Optional
import requests

from engine.data.config import settings
from engine.notifier.base import BaseNotifier

logger = logging.getLogger("signaldesk.notifier.whatsapp")


class WhatsAppCloudNotifier(BaseNotifier):
    """Notifier implementation for Meta's WhatsApp Cloud API."""

    def __init__(
        self,
        phone_number_id: Optional[str] = None,
        access_token: Optional[str] = None,
    ):
        self.phone_number_id = phone_number_id or settings.whatsapp_phone_number_id
        self.access_token = access_token or settings.whatsapp_access_token
        self.api_url = f"https://graph.facebook.com/v20.0/{self.phone_number_id}/messages"

    def is_configured(self) -> bool:
        return bool(self.phone_number_id and self.access_token)

    @staticmethod
    def _clean_phone_number(phone: str) -> str:
        """Standardizes phone number into E.164 digits format (e.g., 919876543210)."""
        cleaned = re.sub(r"[^\d]", "", phone)
        # Default to Indian country code +91 if 10 digits provided
        if len(cleaned) == 10:
            cleaned = f"91{cleaned}"
        return cleaned

    def format_signal_message(self, s: Dict[str, Any]) -> str:
        symbol = s.get("symbol", "N/A")
        trade_type = s.get("tradeType", "INTRADAY")
        side = s.get("side", "BUY")
        entry = float(s.get("entry", 0.0))
        sl = float(s.get("sl", 0.0))
        tp = float(s.get("tp", 0.0))
        rr = float(s.get("rr", 0.0))
        conf = s.get("confidence", 0)
        reasons = s.get("reasons", [])
        asset_class = str(s.get("assetClass") or ("crypto" if "/" in str(symbol) else "equity")).lower()
        exchange = str(s.get("exchange") or (settings.crypto_exchange.upper() if asset_class == "crypto" else "NSE")).upper()

        action_emoji = "🟢" if side == "BUY" else "🔴"
        type_emoji = "⚡" if trade_type in ("INTRADAY", "SCALP") else "📦"
        asset_tag = f"[CRYPTO · {exchange}]" if asset_class == "crypto" else f"[{exchange}]"
        curr = "$" if asset_class == "crypto" else "₹"
        decimals = 4 if entry < 10.0 and asset_class == "crypto" else 2

        reasons_bullet = "\n".join([f"  • {r}" for r in reasons[:4]]) if reasons else "  • Multi-timeframe confluence"

        return (
            f"🔔 *SIGNALDESK ALERT* {action_emoji}\n\n"
            f"*{symbol}* {asset_tag} ({trade_type} {type_emoji})\n"
            f"Action: *{side}*\n"
            f"Entry: *{curr}{entry:.{decimals}f}*\n"
            f"Stop Loss: *{curr}{sl:.{decimals}f}*\n"
            f"Target: *{curr}{tp:.{decimals}f}*\n"
            f"Risk-Reward: *1:{rr:.2f}*\n"
            f"Confidence: *{conf}%*\n\n"
            f"*Key Confluences:*\n{reasons_bullet}\n\n"
            f"⚠️ _Signal tool only. Not financial advice. Crypto is highly volatile._"
        )

    def send_signal_alert(self, signal_data: Dict[str, Any], recipient: str) -> bool:
        if not self.is_configured():
            logger.warning("WhatsApp Cloud API credentials not configured.")
            return False

        to_num = self._clean_phone_number(recipient)
        msg_body = self.format_signal_message(signal_data)

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_num,
            "type": "text",
            "text": {"preview_url": False, "body": msg_body},
        }

        try:
            resp = requests.post(self.api_url, json=payload, headers=headers, timeout=10)
            if resp.status_code in (200, 201):
                logger.info(f"WhatsApp alert successfully dispatched to {to_num[:4]}****{to_num[-2:]}")
                return True
            else:
                logger.error(f"WhatsApp API failed with status {resp.status_code}: {resp.text}")
                return False
        except Exception as exc:
            logger.error(f"WhatsApp API exception: {exc}")
            return False

    def send_test_message(self, recipient: str) -> bool:
        if not self.is_configured():
            logger.warning("WhatsApp Cloud API credentials not configured.")
            return False

        to_num = self._clean_phone_number(recipient)
        body = (
            "✅ *SignalDesk WhatsApp Alert Connection Verified!*\n\n"
            "You are set to receive real-time Indian stock market setups with Entry, SL, and TP.\n\n"
            "⚠️ _Educational alerts only. Not financial advice._"
        )

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_num,
            "type": "text",
            "text": {"preview_url": False, "body": body},
        }

        try:
            resp = requests.post(self.api_url, json=payload, headers=headers, timeout=10)
            return resp.status_code in (200, 201)
        except Exception as exc:
            logger.error(f"Test WhatsApp exception: {exc}")
            return False
