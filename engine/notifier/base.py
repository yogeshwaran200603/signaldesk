"""Pluggable Notifier Interface for SignalDesk.

Provides abstract base class for alert delivery across WhatsApp Cloud API,
Twilio fallback, and Log-only fallback.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class BaseNotifier(ABC):
    """Abstract base class for signal notifications."""

    @abstractmethod
    def send_signal_alert(
        self,
        signal_data: Dict[str, Any],
        recipient: str,
    ) -> bool:
        """Sends a formatted trading signal notification to recipient.

        Args:
            signal_data: Dict containing symbol, tradeType, side, entry, sl, tp, rr, confidence, reasons.
            recipient: WhatsApp phone number in E.164 format (e.g., +919876543210).

        Returns:
            bool: True if alert sent successfully, False otherwise.
        """
        pass

    @abstractmethod
    def send_test_message(self, recipient: str) -> bool:
        """Sends a test confirmation notification to verify connectivity.

        Args:
            recipient: WhatsApp phone number.

        Returns:
            bool: True if sent successfully, False otherwise.
        """
        pass
