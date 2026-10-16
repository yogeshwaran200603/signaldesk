"""CLI Runner for SignalDesk Backtesting Suite.

Fetches 6-12 months of historical market data, runs candle-by-candle backtesting
with realistic slippage and brokerage, outputs metrics, CSV trade logs, and markdown/HTML reports.
"""

import argparse
import sys
from pathlib import Path
from typing import List

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import pandas as pd
from engine.data.providers import (
    get_provider,
    TRADE_TYPE_TIMEFRAMES,
    normalize_crypto_symbol,
)
from engine.data.candle_cache import fetch_cached_or_provider_candles
from engine.backtest.engine import BacktestRunner, BacktestConfig


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def run_stock_backtest(
    symbol: str,
    days: int = 180,
    trade_type: str = "INTRADAY",
    reports_dir: Path = Path("engine/backtest/reports"),
    asset_class: str = "equity",
    exchange: str = "",
) -> None:
    """Executes backtest for a specific symbol (equity or crypto) and exports reports."""
    ac = (asset_class or ("crypto" if "/" in symbol else "equity")).lower().strip()
    if ac == "crypto":
        symbol = normalize_crypto_symbol(symbol) or symbol
    t_type_upper = trade_type.upper().strip()
    config = BacktestConfig.for_asset_class(ac, exchange or None)
    cur_label = "USDT" if ac == "crypto" else "INR"

    print(f"\n{'='*70}")
    print(f"RUNNING BACKTEST: {symbol} ({ac.upper()} · {config.exchange}) | Type: {t_type_upper} | Lookback: {days} Days")
    print(f"{'='*70}")

    runner = BacktestRunner(config=config)
    provider = get_provider(ac, exchange_id=config.exchange.lower() if ac == "crypto" else None)

    tf_map = TRADE_TYPE_TIMEFRAMES.get(ac, TRADE_TYPE_TIMEFRAMES["equity"])
    tfs = tf_map.get(t_type_upper)
    if not tfs:
        default_tf = "15m" if ac == "crypto" else "5m"
        default_htf = "1h"
        tfs = {"entry": default_tf, "bias": default_htf}

    entry_tf = tfs["entry"]
    htf_tf = tfs["bias"]

    try:
        print(f"[{symbol}] Fetching {entry_tf} entry candles ({days} days)...")
        entry_df = fetch_cached_or_provider_candles(
            symbol=symbol,
            interval=entry_tf,
            days=days,
            asset_class=ac,
            exchange=config.exchange,
            provider=provider,
        )
        print(f"[{symbol}] Fetching {htf_tf} HTF bias candles...")
        htf_df = fetch_cached_or_provider_candles(
            symbol=symbol,
            interval=htf_tf,
            days=days,
            asset_class=ac,
            exchange=config.exchange,
            provider=provider,
        )

        if entry_df.empty or len(entry_df) < 50:
            print(f"[WARN] Insufficient candle data for {symbol} (got {len(entry_df)} candles).")
            return

        print(f"[{symbol}] Running chronological walk-forward backtest on {len(entry_df)} bars...")
        metrics, trades = runner.run(
            symbol=symbol,
            entry_df=entry_df,
            htf_bias_df=htf_df,
            trade_type=t_type_upper,
            asset_class=ac,
            exchange=config.exchange,
        )

        # Export reports
        exported = runner.export_reports(
            symbol=symbol,
            trade_type=t_type_upper,
            metrics=metrics,
            trades=trades,
            output_dir=reports_dir,
            asset_class=ac,
            exchange=config.exchange,
        )

        # Print console results
        print("\n" + "=" * 60)
        print(f"BACKTEST RESULTS: {symbol} [{ac.upper()}] ({t_type_upper}) &mdash; NET OF REAL COSTS")
        print("=" * 60)
        print(f"Total Completed Trades:      {metrics.total_trades}")
        print(f"Win / Loss / Square-Off:     {metrics.win_trades} / {metrics.loss_trades} / {metrics.square_off_trades}")
        print(f"Win Rate:                    {metrics.win_rate_pct:.2f}%")
        print(f"Average Risk-Reward:         1:{metrics.avg_rr:.2f}")
        print(f"Net Expectancy per Trade:    {metrics.net_expectancy_r:+.2f} R  <-- (AFTER ALL TAXES & SLIPPAGE)")
        print(f"Gross Expectancy (Pre-fee):  {metrics.gross_expectancy_r:+.2f} R")
        print(f"Net Profit Factor:           {metrics.net_profit_factor:.2f} (Gross: {metrics.gross_profit_factor:.2f})")
        print(f"Max Drawdown:                {metrics.max_drawdown_r:.2f} R ({metrics.max_drawdown_pct:.2f}%)")
        print(f"Total Statutory Fees & Slip: {cur_label} {metrics.total_costs:,.2f}")
        print(f"Net Realized Profit:         {cur_label} {metrics.net_profit:,.2f} ({metrics.net_profit_pct:+.2f}%)")
        print(f"Starting / Final Capital:    {cur_label} {metrics.initial_capital:,.2f} / {cur_label} {metrics.final_capital:,.2f}")
        print("-" * 60)
        print(f"Trade log saved:             {exported['csv']}")
        print(f"JSON breakdown saved:        {exported.get('json', '')}")
        print(f"Markdown report:             {exported['md']}")
        print(f"HTML report:                 {exported['html']}")
        print("=" * 60)

    except Exception as exc:
        print(f"[ERROR] Backtest failed for {symbol}: {exc}")


def main():
    parser = argparse.ArgumentParser(description="SignalDesk Multi-Asset Backtester CLI")
    parser.add_argument("--symbols", nargs="+", default=["TCS", "IDEA", "OLAELEC"], help="Symbols to test (e.g. TCS or BTC/USDT)")
    parser.add_argument("--asset-class", choices=["equity", "crypto"], default="equity", help="Asset class (equity or crypto)")
    parser.add_argument("--days", type=int, default=90, help="Lookback days (default: 90)")
    parser.add_argument(
        "--type",
        choices=["INTRADAY", "DELIVERY", "SCALP", "SWING", "BOTH"],
        default="BOTH",
        help="Trade type",
    )

    args = parser.parse_args()
    reports_dir = Path(__file__).resolve().parent / "reports"

    for sym in args.symbols:
        ac = "crypto" if ("/" in sym or args.asset_class == "crypto") else "equity"
        if args.type == "BOTH":
            trade_types = ["SCALP", "INTRADAY", "SWING"] if ac == "crypto" else ["INTRADAY", "DELIVERY"]
        else:
            trade_types = [args.type]

        for t_type in trade_types:
            run_stock_backtest(
                symbol=sym,
                days=args.days,
                trade_type=t_type,
                reports_dir=reports_dir,
                asset_class=ac,
            )


if __name__ == "__main__":
    main()
