"""Configuration management for SignalDesk engine.

Loads environment variables from engine/.env or system environment.
Ensures secrets are never logged or leaked.
"""

import os
from pathlib import Path
from dataclasses import dataclass
from typing import Optional
from dotenv import load_dotenv

# Base directory for engine
ENGINE_DIR = Path(__file__).resolve().parent.parent

# Load .env file from engine directory
env_path = ENGINE_DIR / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()


@dataclass(frozen=True)
class Settings:
    angel_api_key: str = os.getenv("ANGEL_API_KEY", "")
    angel_client_id: str = os.getenv("ANGEL_CLIENT_ID", "")
    angel_pin: str = os.getenv("ANGEL_PIN", "")
    angel_totp_secret: str = os.getenv("ANGEL_TOTP_SECRET", "")
    firebase_service_account: str = os.getenv("FIREBASE_SERVICE_ACCOUNT", "serviceAccountKey.json")
    whatsapp_phone_number_id: str = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    whatsapp_access_token: str = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    paper_mode: bool = os.getenv("PAPER_MODE", "true").strip().lower() in ("true", "1", "yes")
    ml_threshold: float = float(os.getenv("ML_THRESHOLD", "0.60"))
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_secret_key: str = os.getenv("SUPABASE_SECRET_KEY", "")
    database_url: str = os.getenv("DATABASE_URL", "")
    crypto_exchange: str = os.getenv("CRYPTO_EXCHANGE", "binance").strip().lower() or "binance"
    forex_provider: str = os.getenv("FOREX_PROVIDER", "").strip().lower()
    forex_api_key: str = os.getenv("FOREX_API_KEY", "").strip()
    web_origin: str = os.getenv("WEB_ORIGIN", "http://localhost:3000").strip() or "http://localhost:3000"

    @property
    def firebase_service_account_path(self) -> Path:
        account_path = Path(self.firebase_service_account)
        if not account_path.is_absolute():
            account_path = ENGINE_DIR / account_path
        return account_path

    def validate_angel_credentials(self) -> list[str]:
        """Returns list of missing Angel variable names."""
        missing = []
        if not self.angel_api_key:
            missing.append("ANGEL_API_KEY")
        if not self.angel_client_id:
            missing.append("ANGEL_CLIENT_ID")
        if not self.angel_pin:
            missing.append("ANGEL_PIN")
        if not self.angel_totp_secret:
            missing.append("ANGEL_TOTP_SECRET")
        return missing

    def validate_firebase_credentials(self) -> list[str]:
        """Returns list of missing Firebase credentials/files."""
        missing = []
        if not self.firebase_service_account_path.exists():
            missing.append("FIREBASE_SERVICE_ACCOUNT")
        return missing

    def validate_supabase_credentials(self) -> list[str]:
        """Validates SUPABASE_URL and SUPABASE_SECRET_KEY format and presence.

        Returns list of error messages naming variable names only (never values).
        """
        errors = []
        if not self.supabase_url:
            errors.append("SUPABASE_URL is missing or empty")
        else:
            url = self.supabase_url.strip()
            if url.startswith('"') or url.startswith("'") or url.endswith('"') or url.endswith("'"):
                errors.append("SUPABASE_URL contains surrounding quotes; please remove them")
            elif "<" in url or ">" in url:
                errors.append("SUPABASE_URL contains placeholder angle brackets '<>'; replace with real project ref")
            elif "supabase.com/dashboard" in url:
                errors.append("SUPABASE_URL is a dashboard URL; format must be https://<project-ref>.supabase.co")
            elif not url.startswith("https://") or ".supabase.co" not in url:
                errors.append("SUPABASE_URL must be in the format https://<project-ref>.supabase.co")

        if not self.supabase_secret_key:
            errors.append("SUPABASE_SECRET_KEY is missing or empty")
        else:
            key = self.supabase_secret_key.strip()
            if key.startswith('"') or key.startswith("'") or key.endswith('"') or key.endswith("'"):
                errors.append("SUPABASE_SECRET_KEY contains surrounding quotes; please remove them")

        return errors

    def __repr__(self) -> str:
        # Prevent secret leaks in representations or logs
        return (
            f"Settings("
            f"angel_client_id={'***' if self.angel_client_id else 'NOT_SET'}, "
            f"firebase_configured={self.firebase_service_account_path.exists()}, "
            f"supabase_configured={bool(self.supabase_url and self.supabase_secret_key)}, "
            f"paper_mode={self.paper_mode}, "
            f"ml_threshold={self.ml_threshold})"
        )


settings = Settings()
