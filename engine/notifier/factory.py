"""Notifier factory for SignalDesk.

Selects the best available notifier implementation based on active configuration:
1. Meta WhatsApp Cloud API (Primary)
2. Twilio WhatsApp API (Fallback)
3. LogNotifier (Log-only fallback ensuring 100% uptime when keys are missing)
"""

import logging
from engine.notifier.base import BaseNotifier
from engine.notifier.whatsapp import WhatsAppCloudNotifier
from engine.notifier.twilio_fallback import TwilioWhatsAppNotifier
from engine.notifier.log_fallback import LogNotifier

logger = logging.getLogger("signaldesk.notifier")


def get_notifier() -> BaseNotifier:
    """Returns the most appropriate configured Notifier instance."""
    meta = WhatsAppCloudNotifier()
    if meta.is_configured():
        return meta

    twilio = TwilioWhatsAppNotifier()
    if twilio.is_configured():
        logger.info("Using Twilio WhatsApp fallback notifier.")
        return twilio

    logger.info("External WhatsApp credentials not found. Using LogNotifier fallback.")
    return LogNotifier()
