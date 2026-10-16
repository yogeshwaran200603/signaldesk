"""Notifier package for SignalDesk."""

from engine.notifier.base import BaseNotifier
from engine.notifier.factory import get_notifier

__all__ = ["BaseNotifier", "get_notifier"]
