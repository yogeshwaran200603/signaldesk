-- ==============================================================================
-- SignalDesk Supabase (PostgreSQL) Initial Schema Migration: 001_initial_schema.sql
-- Handles candle cache, backtest metrics, ML model registry, signal analytics, and engine events.
-- Row Level Security (RLS) is enabled on all tables with no public policies.
-- Engine connects server-side via Supabase Secret Key (service role).
-- ==============================================================================

-- 1. Candle Cache Table (Multi-Asset: Equities & Crypto)
CREATE TABLE IF NOT EXISTS candles (
    symbol TEXT NOT NULL,
    asset_class TEXT NOT NULL DEFAULT 'equity',
    exchange TEXT NOT NULL DEFAULT 'NSE',
    interval TEXT NOT NULL,
    ts TIMESTAMPTZ NOT NULL,
    open NUMERIC NOT NULL,
    high NUMERIC NOT NULL,
    low NUMERIC NOT NULL,
    close NUMERIC NOT NULL,
    volume NUMERIC NOT NULL DEFAULT 0,
    PRIMARY KEY (symbol, exchange, interval, ts)
);

CREATE INDEX IF NOT EXISTS idx_candles_lookup ON candles (symbol, exchange, interval, ts DESC);

-- 2. Backtest Runs Table
CREATE TABLE IF NOT EXISTS backtest_runs (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    asset_class TEXT NOT NULL DEFAULT 'equity',
    exchange TEXT NOT NULL DEFAULT 'NSE',
    trade_type TEXT NOT NULL,
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_backtest_runs_symbol ON backtest_runs (symbol, started_at DESC);

-- 3. Backtest Trades Table
CREATE TABLE IF NOT EXISTS backtest_trades (
    id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES backtest_runs(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    asset_class TEXT NOT NULL DEFAULT 'equity',
    exchange TEXT NOT NULL DEFAULT 'NSE',
    trade_type TEXT NOT NULL,
    side TEXT NOT NULL,
    entry NUMERIC NOT NULL,
    sl NUMERIC NOT NULL,
    tp NUMERIC NOT NULL,
    rr NUMERIC NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    outcome TEXT NOT NULL,
    pnl_r NUMERIC NOT NULL,
    features JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_backtest_trades_run_id ON backtest_trades (run_id);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_symbol ON backtest_trades (symbol);

-- 4. Signal Outcomes Table (Analytics mirror of Firestore signals)
CREATE TABLE IF NOT EXISTS signal_outcomes (
    signal_id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    symbol TEXT NOT NULL,
    asset_class TEXT NOT NULL DEFAULT 'equity',
    exchange TEXT NOT NULL DEFAULT 'NSE',
    trade_type TEXT NOT NULL,
    side TEXT NOT NULL,
    entry NUMERIC NOT NULL,
    sl NUMERIC NOT NULL,
    tp NUMERIC NOT NULL,
    rr NUMERIC NOT NULL,
    status TEXT NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    exit_price NUMERIC,
    pnl_r NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_signal_outcomes_uid ON signal_outcomes (uid, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_outcomes_symbol ON signal_outcomes (symbol);

-- 5. ML Models Registry Table
CREATE TABLE IF NOT EXISTS ml_models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    trained_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    path TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ml_models_active ON ml_models (active) WHERE active = TRUE;

-- 6. Engine Events Audit Table
CREATE TABLE IF NOT EXISTS engine_events (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_engine_events_ts ON engine_events (ts DESC);

-- ==============================================================================
-- Row Level Security (RLS) Configuration
-- Enable RLS on EVERY table with NO public policies.
-- Engine connects server-side via Supabase Secret Key (service role).
-- ==============================================================================
ALTER TABLE candles ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE engine_events ENABLE ROW LEVEL SECURITY;
