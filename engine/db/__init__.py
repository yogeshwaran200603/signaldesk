"""Database package for SignalDesk analytics and historical data."""

from engine.db.supabase_client import (
    get_supabase_client,
    check_supabase_health,
)

__all__ = ["get_supabase_client", "check_supabase_health"]
