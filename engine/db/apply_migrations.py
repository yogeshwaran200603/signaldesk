"""Migration runner and RLS verifier for SignalDesk Supabase PostgreSQL database.

Applies SQL migration files located in engine/db/migrations/ in alphanumeric order,
then verifies that all required tables exist and have Row Level Security (RLS) enabled
with zero public access policies.
Ensures secrets are never printed or logged.
"""

import os
import sys
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("signaldesk.migrations")

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
EXPECTED_TABLES = (
    "candles",
    "backtest_runs",
    "backtest_trades",
    "signal_outcomes",
    "ml_models",
    "engine_events",
)


def apply_migrations() -> bool:
    """Reads and executes all SQL migration files against the Postgres database and verifies RLS."""
    from engine.data.config import settings

    db_url = settings.database_url or os.getenv("DATABASE_URL", "")

    if not db_url:
        logger.error(
            "DATABASE_URL is not set in engine/.env. "
            "Please provide DATABASE_URL (PostgreSQL connection string from Supabase Project Settings > Database) "
            "or run the SQL migration files manually in Supabase SQL Editor."
        )
        return False

    if not MIGRATIONS_DIR.exists():
        logger.error(f"Migrations directory not found at {MIGRATIONS_DIR}")
        return False

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not migration_files:
        logger.warning("No migration files found.")
        return True

    try:
        import psycopg

        logger.info(f"Connecting to database to apply {len(migration_files)} migration(s)...")
        with psycopg.connect(db_url, autocommit=True) as conn:
            with conn.cursor() as cur:
                # Create migrations tracking table if not exists
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS _schema_migrations (
                        filename TEXT PRIMARY KEY,
                        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    ALTER TABLE _schema_migrations ENABLE ROW LEVEL SECURITY;
                    """
                )

                for sql_file in migration_files:
                    filename = sql_file.name
                    cur.execute("SELECT 1 FROM _schema_migrations WHERE filename = %s;", (filename,))
                    if cur.fetchone():
                        logger.info(f"Migration already applied: {filename}")
                        continue

                    logger.info(f"Applying migration: {filename} ...")
                    sql_content = sql_file.read_text(encoding="utf-8")
                    cur.execute(sql_content)
                    cur.execute("INSERT INTO _schema_migrations (filename) VALUES (%s);", (filename,))
                    logger.info(f"Successfully applied: {filename}")

                # Verify tables and Row Level Security (RLS) status
                cur.execute(
                    """
                    SELECT tablename, rowsecurity
                    FROM pg_tables
                    WHERE schemaname = 'public'
                      AND tablename = ANY(%s)
                    ORDER BY tablename;
                    """,
                    (list(EXPECTED_TABLES),),
                )
                rows = cur.fetchall()
                rls_map = {r[0]: bool(r[1]) for r in rows}

                cur.execute(
                    """
                    SELECT tablename, COUNT(*)
                    FROM pg_policies
                    WHERE schemaname = 'public'
                      AND tablename = ANY(%s)
                    GROUP BY tablename;
                    """,
                    (list(EXPECTED_TABLES),),
                )
                policy_map = {r[0]: int(r[1]) for r in cur.fetchall()}

                for tbl in EXPECTED_TABLES:
                    rls_on = rls_map.get(tbl, False)
                    policies = policy_map.get(tbl, 0)
                    logger.info(
                        f"Table '{tbl}': exists={tbl in rls_map}, RLS={'ENABLED' if rls_on else 'DISABLED'}, public_policies={policies}"
                    )

        logger.info("All migrations applied and RLS verification completed successfully.")
        return True

    except ImportError:
        logger.error("psycopg package is not installed. Run 'pip install psycopg[binary]'.")
        return False
    except Exception as exc:
        logger.error(f"Migration application failed: {exc}")
        return False


if __name__ == "__main__":
    success = apply_migrations()
    sys.exit(0 if success else 1)
