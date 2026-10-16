-- ==============================================================================
-- SignalDesk Supabase Migration: 002_multi_asset_crypto_schema.sql
-- Idempotently adds asset_class and exchange columns to existing tables and
-- ensures composite PK (symbol, exchange, interval, ts) and RLS on all tables.
-- ==============================================================================

-- 1. Add multi-asset columns if upgrading from an earlier 001 schema
ALTER TABLE candles ADD COLUMN IF NOT EXISTS asset_class TEXT NOT NULL DEFAULT 'equity';
ALTER TABLE candles ADD COLUMN IF NOT EXISTS exchange TEXT NOT NULL DEFAULT 'NSE';

ALTER TABLE backtest_runs ADD COLUMN IF NOT EXISTS asset_class TEXT NOT NULL DEFAULT 'equity';
ALTER TABLE backtest_runs ADD COLUMN IF NOT EXISTS exchange TEXT NOT NULL DEFAULT 'NSE';

ALTER TABLE backtest_trades ADD COLUMN IF NOT EXISTS asset_class TEXT NOT NULL DEFAULT 'equity';
ALTER TABLE backtest_trades ADD COLUMN IF NOT EXISTS exchange TEXT NOT NULL DEFAULT 'NSE';

ALTER TABLE signal_outcomes ADD COLUMN IF NOT EXISTS asset_class TEXT NOT NULL DEFAULT 'equity';
ALTER TABLE signal_outcomes ADD COLUMN IF NOT EXISTS exchange TEXT NOT NULL DEFAULT 'NSE';

-- 2. Ensure composite primary key on candles includes exchange
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'candles'
          AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE candles DROP CONSTRAINT candles_pkey;
    END IF;
    ALTER TABLE candles ADD PRIMARY KEY (symbol, exchange, interval, ts);
EXCEPTION
    WHEN others THEN
        NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_candles_multi_lookup ON candles (symbol, exchange, interval, ts DESC);

-- 3. Re-confirm Row Level Security (RLS) on every table with no public policies
ALTER TABLE candles ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE engine_events ENABLE ROW LEVEL SECURITY;
