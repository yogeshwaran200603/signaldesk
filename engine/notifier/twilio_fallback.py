"""Twilio fallback Notifier for SignalDesk.

Provides optional secondary WhatsApp alert dispatch via Twilio API.
"""

import logging
import os
from typing import Any, Dict, Optional
import requests
from requests.auth import HTTPBasicAuth

from engine.notifier.base import BaseNotifier

logger = logging.getLogger("signaldesk.notifier.twilio")


class TwilioWhatsAppNotifier(BaseNotifier):
    """Optional Twilio fallback notifier."""

    def __init__(
        self,
        account_sid: Optional[str] = None,
        auth_token: Optional[str] = None,
        from_number: Optional[str] = None,
    ):
        self.account_sid = account_sid or os.getenv("TWILIO_ACCOUNT_SID", "")
        self.auth_token = auth_token or os.getenv("TWILIO_AUTH_TOKEN", "")
        self.from_number = from_number or os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")

    def is_configured(self) -> bool:
        return bool(self.account_sid and self.auth_token)

    def send_signal_alert(self, signal_data: Dict[str, Any], recipient: str) -> bool:
        if not self.is_configured():
            return False

        to_formatted = f"whatsapp:{recipient}" if not recipient.startswith("whatsapp:") else recipient
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        body = (
            f"🔔 *SIGNALDESK ALERT*\n"
            f"{signal_data.get('symbol')} ({signal_data.get('tradeType')})\n"
            f"Side: {signal_data.get('side')} | Entry: ₹{signal_data.get('entry')}\n"
            f"SL: ₹{signal_data.get('sl')} | TP: ₹{signal_data.get('tp')}\n"
            f"RR: 1:{signal_data.get('rr')} | Confidence: {signal_data.get('confidence')}%\n"
            f"⚠️ Educational signal only."
        )

        try:
            resp = requests.post(
                url,
                data={"From": self.from_number, "To": to_formatted, "Body": body},
                auth=HTTPBasicAuth(self.account_sid, self.auth_token),
                timeout=10,
            )
            return resp.status_code in (200, 201)
        except Exception as exc:
            logger.error(f"Twilio WhatsApp exception: {exc}")
            return False

    def send_test_message(self, recipient: str) -> bool:
        if not self.is_configured():
            return False

        to_formatted = f"whatsapp:{recipient}" if not recipient.startswith("whatsapp:") else recipient
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        body = "✅ SignalDesk: Twilio WhatsApp alert connection verified!"

        try:
            resp = requests.post(
                url,
                data={"From": self.from_number, "To": to_formatted, "Body": body},
                auth=HTTPBasicAuth(self.account_sid, self.auth_token),
                timeout=10,
            )
            return resp.status_code in (200, 201)
        except Exception as exc:
            logger.error(f"Twilio test message exception: {exc}")
            return False
