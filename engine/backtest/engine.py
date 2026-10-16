"""Backtesting engine for SignalDesk (Phase 1 Upgraded).

Key Features:
- Candle-by-candle sequential replay through the unified LiveStrategyEngine (identical code path as live).
- Real Indian market cash intraday (MIS) statutory cost model (Brokerage, STT, Exchange, SEBI, Stamp Duty, GST, Slippage).
- 15:15 IST (3:15 PM) mandatory intraday square-off enforcement.
- SL-first conflict resolution rule if SL and TP are both touched in the same candle.
- Mathematical Expectancy in R: reported both Gross and Net of all statutory costs and slippage.
- Per-day and per-symbol granular performance breakdown.
- Export to JSON, CSV, Markdown, and HTML reports.
"""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple
import numpy as np
import pandas as pd

from engine.backtest.costs import calculate_nse_mis_costs, CostBreakdown, cost_model
from engine.strategies.live_engine import (
    LiveStrategyEngine,
    resolve_mode_timeframes,
)
from engine.strategies.trade_builder import _round_price

logger = logging.getLogger("signaldesk.backtest")


@dataclass
class BacktestConfig:
    brokerage_pct: float = 0.0005 # Legacy brokerage attribute for backwards compatibility
    slippage_pct: float = 0.0003  # 0.03% default slippage per leg
    initial_capital: float = 100000.0  # ₹100,000 INR starting capital
    risk_per_trade_pct: float = 0.01   # 1% equity risk per setup
    max_open_trades: int = 1           # Concurrency limit per symbol
    asset_class: str = "equity"
    exchange: str = "NSE"
    ml_threshold: Optional[float] = None  # None uses system default (0.65)
    enforce_315_square_off: bool = True   # Force exit at 15:15 IST for intraday

    @classmethod
    def for_asset_class(
        cls, asset_class: str = "equity", exchange: Optional[str] = None
    ) -> "BacktestConfig":
        ac = (asset_class or "equity").lower().strip()
        if ac == "crypto":
            return cls(
                brokerage_pct=0.0010,
                slippage_pct=0.0005,
                initial_capital=10000.0,
                risk_per_trade_pct=0.01,
                max_open_trades=1,
                asset_class="crypto",
                exchange=(exchange or "BINANCE").upper(),
                enforce_315_square_off=False,
            )
        return cls(
            brokerage_pct=0.0005,
            slippage_pct=0.0003,
            initial_capital=100000.0,
            risk_per_trade_pct=0.01,
            max_open_trades=1,
            asset_class="equity",
            exchange=(exchange or "NSE").upper(),
            enforce_315_square_off=True,
        )


@dataclass
class BacktestTrade:
    trade_id: str
    symbol: str
    trade_type: str
    side: str
    entry_time: str
    exit_time: str
    entry_price: float
    entry_price_executed: float
    exit_price: float
    exit_price_executed: float
    sl: float
    tp: float
    quantity: float
    status: Literal["TP HIT", "SL HIT", "SQUARE_OFF_315", "EXPIRED"]
    exit_reason: str
    rr_planned: float
    gross_pnl: float
    net_pnl: float
    gross_r: float
    net_r: float
    total_costs: float
    brokerage: float
    stt: float
    exchange_charges: float
    sebi_charges: float
    stamp_duty: float
    gst: float
    slippage_cost: float
    confidence: int
    reasons: List[str] = field(default_factory=list)
    asset_class: str = "equity"
    exchange: str = "NSE"
    features: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @property
    def pnl(self) -> float:
        return self.net_pnl

    @property
    def r_multiple(self) -> float:
        return self.net_r

    @property
    def pnl_pct(self) -> float:
        val = self.entry_price * self.quantity
        return round((self.net_pnl / val) * 100, 2) if val > 0 else 0.0


@dataclass
class BacktestMetrics:
    total_trades: int
    win_trades: int
    loss_trades: int
    square_off_trades: int
    win_rate_pct: float
    avg_rr: float
    avg_win_r: float
    avg_loss_r: float
    gross_expectancy_r: float
    net_expectancy_r: float
    gross_profit_factor: float
    net_profit_factor: float
    max_drawdown_r: float
    max_drawdown_pct: float
    gross_profit: float
    net_profit: float
    net_profit_pct: float
    total_costs: float
    initial_capital: float
    final_capital: float
    per_day_breakdown: List[Dict[str, Any]] = field(default_factory=list)
    per_symbol_breakdown: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @property
    def expectancy(self) -> float:
        return self.net_expectancy_r

    @property
    def profit_factor(self) -> float:
        return self.net_profit_factor


def _is_past_square_off_time(time_val: Any) -> bool:
    """Detects if bar timestamp is at or past 15:15 IST (3:15 PM Indian Standard Time)."""
    try:
        ts = pd.to_datetime(time_val)
        # If timestamp is timezone-aware, convert to Asia/Kolkata
        if ts.tz is not None:
            ts = ts.tz_convert("Asia/Kolkata")
        # Check hour and minute in IST
        return ts.hour > 15 or (ts.hour == 15 and ts.minute >= 15)
    except Exception:
        return False


def _extract_date_str(time_val: Any) -> str:
    """Extracts YYYY-MM-DD string from timestamp."""
    try:
        ts = pd.to_datetime(time_val)
        return ts.strftime("%Y-%m-%d")
    except Exception:
        return str(time_val)[:10]


class BacktestRunner:
    """Executes chronological historical replay through the unified LiveStrategyEngine."""

    def __init__(self, config: Optional[BacktestConfig] = None):
        self.config = config or BacktestConfig()

    def walk_forward_split(
        self, df: pd.DataFrame, train_pct: float = 0.70
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Chronological train/test split for walk-forward validation."""
        split_idx = int(len(df) * train_pct)
        return df.iloc[:split_idx].copy(), df.iloc[split_idx:].copy()

    def run(
        self,
        symbol: str,
        entry_df: pd.DataFrame,
        htf_bias_df: Optional[pd.DataFrame] = None,
        trade_type: str = "INTRADAY",
        asset_class: Optional[str] = None,
        exchange: Optional[str] = None,
    ) -> Tuple[BacktestMetrics, List[BacktestTrade]]:
        eff_asset_class = (asset_class or self.config.asset_class or "equity").lower().strip()
        eff_exchange = (exchange or self.config.exchange or ("BINANCE" if eff_asset_class == "crypto" else "NSE")).upper()
        t_type_upper = trade_type.upper().strip()

        if len(entry_df) < 50:
            empty_m = BacktestMetrics(
                0, 0, 0, 0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                self.config.initial_capital, self.config.initial_capital
            )
            return empty_m, []

        entry_df = entry_df.sort_values("time").reset_index(drop=True)
        trades: List[BacktestTrade] = []
        open_trade: Optional[Dict[str, Any]] = None

        capital = self.config.initial_capital
        equity_curve_net = [capital]
        running_net_r = 0.0
        peak_net_r = 0.0
        max_dd_r = 0.0
        peak_capital = capital
        max_dd_pct = 0.0

        min_lookback = 35
        htf_ptr = 0
        has_htf = htf_bias_df is not None and not htf_bias_df.empty
        if has_htf:
            htf_bias_df = htf_bias_df.sort_values("time").reset_index(drop=True)

        # Isolated LiveStrategyEngine instance for the backtest replay (zero memory leakage)
        live_engine = LiveStrategyEngine(ml_threshold=self.config.ml_threshold)

        for i in range(min_lookback, len(entry_df)):
            cur_candle = entry_df.iloc[i]
            cur_time = cur_candle["time"]
            cur_time_dt = pd.to_datetime(cur_time, utc=True).to_pydatetime()
            c_high = float(cur_candle["high"])
            c_low = float(cur_candle["low"])
            c_close = float(cur_candle["close"])

            # Sync HTF window without forward-looking bias
            visible_htf: Optional[pd.DataFrame] = None
            if has_htf:
                while htf_ptr < len(htf_bias_df) and htf_bias_df.iloc[htf_ptr]["time"] <= cur_time:
                    htf_ptr += 1
                if htf_ptr >= 15:
                    visible_htf = htf_bias_df.iloc[max(0, htf_ptr - 60) : htf_ptr]

            # -------------------------------------------------------------
            # 1. Manage Active Open Trade
            # -------------------------------------------------------------
            if open_trade is not None:
                side = open_trade["side"]
                sl = open_trade["sl"]
                tp = open_trade["tp"]
                entry_p = open_trade["entry_price"]
                pos_size = open_trade["position_size"]
                trade_date = open_trade["trade_date"]
                cur_date = _extract_date_str(cur_time)

                exit_price: Optional[float] = None
                status: str = ""
                exit_reason: str = ""

                # Check 15:15 IST Intraday Square-off (NSE MIS)
                is_315_exit = False
                if self.config.enforce_315_square_off and eff_asset_class == "equity" and t_type_upper == "INTRADAY":
                    if _is_past_square_off_time(cur_time) or cur_date != trade_date:
                        is_315_exit = True
                        exit_price = c_close
                        status = "SQUARE_OFF_315"
                        exit_reason = "INTRADAY_SQUARE_OFF_315"

                if not is_315_exit:
                    if side == "BUY":
                        hit_sl = c_low <= sl
                        hit_tp = c_high >= tp
                        # SL-first rule: If both touched in same candle, SL counted first
                        if hit_sl:
                            exit_price = sl
                            status = "SL HIT"
                            exit_reason = "STOP_LOSS_HIT"
                        elif hit_tp:
                            exit_price = tp
                            status = "TP HIT"
                            exit_reason = "TARGET_REACHED"
                    else:  # SELL
                        hit_sl = c_high >= sl
                        hit_tp = c_low <= tp
                        if hit_sl:
                            exit_price = sl
                            status = "SL HIT"
                            exit_reason = "STOP_LOSS_HIT"
                        elif hit_tp:
                            exit_price = tp
                            status = "TP HIT"
                            exit_reason = "TARGET_REACHED"

                if exit_price is not None:
                    # Calculate statutory cost breakdown
                    cost_res: CostBreakdown = cost_model.calculate_costs(
                        entry_price=entry_p,
                        exit_price=exit_price,
                        quantity=pos_size,
                        side=side,
                        sl=sl,
                        asset_class=eff_asset_class,
                        slippage_pct=self.config.slippage_pct,
                    )

                    capital += cost_res.net_pnl
                    equity_curve_net.append(capital)
                    if capital > peak_capital:
                        peak_capital = capital
                    dd_pct = ((peak_capital - capital) / peak_capital) * 100.0 if peak_capital > 0 else 0.0
                    if dd_pct > max_dd_pct:
                        max_dd_pct = dd_pct

                    running_net_r += cost_res.net_r
                    if running_net_r > peak_net_r:
                        peak_net_r = running_net_r
                    dd_r = peak_net_r - running_net_r
                    if dd_r > max_dd_r:
                        max_dd_r = dd_r

                    trade_record = BacktestTrade(
                        trade_id=open_trade["id"],
                        symbol=symbol,
                        trade_type=t_type_upper,
                        side=side,
                        entry_time=str(open_trade["entry_time"]),
                        exit_time=str(cur_time),
                        entry_price=entry_p,
                        entry_price_executed=cost_res.entry_price_executed,
                        exit_price=exit_price,
                        exit_price_executed=cost_res.exit_price_executed,
                        sl=sl,
                        tp=tp,
                        quantity=pos_size,
                        status=status,  # type: ignore[arg-type]
                        exit_reason=exit_reason,
                        rr_planned=open_trade["rr"],
                        gross_pnl=cost_res.gross_pnl,
                        net_pnl=cost_res.net_pnl,
                        gross_r=cost_res.gross_r,
                        net_r=cost_res.net_r,
                        total_costs=cost_res.total_costs,
                        brokerage=cost_res.brokerage,
                        stt=cost_res.stt,
                        exchange_charges=cost_res.exchange_charges,
                        sebi_charges=cost_res.sebi_charges,
                        stamp_duty=cost_res.stamp_duty,
                        gst=cost_res.gst,
                        slippage_cost=cost_res.slippage_cost,
                        confidence=open_trade["confidence"],
                        reasons=open_trade["reasons"],
                        asset_class=eff_asset_class,
                        exchange=eff_exchange,
                        features=open_trade.get("features", {}),
                    )
                    trades.append(trade_record)
                    open_trade = None

            # -------------------------------------------------------------
            # 2. Check for New Setup using LiveStrategyEngine (Unified Code Path)
            # -------------------------------------------------------------
            if open_trade is None:
                # Disallow new intraday entries after 15:00 IST
                if self.config.enforce_315_square_off and eff_asset_class == "equity" and t_type_upper == "INTRADAY":
                    try:
                        ts = pd.to_datetime(cur_time)
                        if ts.hour > 15 or (ts.hour == 15 and ts.minute >= 0):
                            continue
                        if ts.hour < 9 or (ts.hour == 9 and ts.minute < 30):
                            continue
                    except Exception:
                        pass

                hist_window = entry_df.iloc[max(0, i - 120) : i + 1].copy().reset_index(drop=True)
                res_entry_tf, res_bias_tf = resolve_mode_timeframes(eff_asset_class, t_type_upper)

                eval_snapshot = live_engine.evaluate(
                    symbol=symbol,
                    entry_df=hist_window,
                    bias_df=visible_htf,
                    asset_class=eff_asset_class,
                    exchange=eff_exchange,
                    mode=t_type_upper,
                    entry_tf=res_entry_tf,
                    bias_tf=res_bias_tf,
                    is_candle_close=True,
                    live_price=c_close,
                    market_open=True,
                    now=cur_time_dt,
                )

                if eval_snapshot.state == "CONFIRMED" and eval_snapshot.signal is not None:
                    sig = eval_snapshot.signal
                    sig_side = sig.get("side", "BUY")
                    sig_entry = float(sig.get("entry", c_close))
                    sig_sl = float(sig.get("sl", 0.0))
                    sig_tp = float(sig.get("tp", 0.0))
                    sig_rr = float(sig.get("rr", 2.0))

                    risk_amount = capital * self.config.risk_per_trade_pct
                    risk_per_unit = abs(sig_entry - sig_sl)

                    if risk_per_unit > 0 and sig_rr >= 1.5:
                        if eff_asset_class == "crypto":
                            pos_units = max(0.0001, round(risk_amount / risk_per_unit, 6))
                        else:
                            pos_units = float(max(1, int(risk_amount / risk_per_unit)))

                        open_trade = {
                            "id": sig.get("id", f"{symbol}_{i}"),
                            "side": sig_side,
                            "entry_time": cur_time,
                            "trade_date": _extract_date_str(cur_time),
                            "entry_price": sig_entry,
                            "sl": sig_sl,
                            "tp": sig_tp,
                            "rr": sig_rr,
                            "confidence": sig.get("confidence", 75),
                            "position_size": pos_units,
                            "reasons": sig.get("reasons", []),
                            "features": {},
                        }

        # Calculate final comprehensive metrics
        metrics = self._calculate_metrics(
            trades=trades,
            initial_cap=self.config.initial_capital,
            final_cap=capital,
            max_dd_pct=max_dd_pct,
            max_dd_r=max_dd_r,
            symbol=symbol,
        )
        return metrics, trades

    def _calculate_metrics(
        self,
        trades: List[BacktestTrade],
        initial_cap: float,
        final_cap: float,
        max_dd_pct: float,
        max_dd_r: float,
        symbol: str,
    ) -> BacktestMetrics:
        if not trades:
            return BacktestMetrics(
                total_trades=0,
                win_trades=0,
                loss_trades=0,
                square_off_trades=0,
                win_rate_pct=0.0,
                avg_rr=0.0,
                avg_win_r=0.0,
                avg_loss_r=0.0,
                gross_expectancy_r=0.0,
                net_expectancy_r=0.0,
                gross_profit_factor=0.0,
                net_profit_factor=0.0,
                max_drawdown_r=0.0,
                max_drawdown_pct=0.0,
                gross_profit=0.0,
                net_profit=0.0,
                net_profit_pct=0.0,
                total_costs=0.0,
                initial_capital=round(initial_cap, 2),
                final_capital=round(final_cap, 2),
                per_day_breakdown=[],
                per_symbol_breakdown=[],
            )

        total = len(trades)
        wins = [t for t in trades if t.net_pnl > 0]
        losses = [t for t in trades if t.net_pnl <= 0]
        square_offs = [t for t in trades if t.status == "SQUARE_OFF_315"]

        win_count = len(wins)
        loss_count = len(losses)
        win_rate = (win_count / total) * 100.0

        avg_rr = float(np.mean([t.rr_planned for t in trades]))
        avg_win_r = float(np.mean([t.net_r for t in wins])) if wins else 0.0
        avg_loss_r = float(np.mean([abs(t.net_r) for t in losses])) if losses else 0.0

        gross_wins = [t for t in trades if t.gross_pnl > 0]
        gross_losses = [t for t in trades if t.gross_pnl <= 0]
        gross_profit_sum = sum(t.gross_pnl for t in gross_wins)
        gross_loss_sum = abs(sum(t.gross_pnl for t in gross_losses))
        gross_pf = round(gross_profit_sum / gross_loss_sum, 2) if gross_loss_sum > 0 else (99.0 if gross_profit_sum > 0 else 0.0)

        net_profit_sum = sum(t.net_pnl for t in wins)
        net_loss_sum = abs(sum(t.net_pnl for t in losses))
        net_pf = round(net_profit_sum / net_loss_sum, 2) if net_loss_sum > 0 else (99.0 if net_profit_sum > 0 else 0.0)

        # Mathematical Expectancy in R: (WinRate * AvgWinR) - (LossRate * AvgLossR)
        p_win = win_count / total
        p_loss = loss_count / total
        net_expectancy = (p_win * avg_win_r) - (p_loss * avg_loss_r)

        avg_win_gross_r = float(np.mean([t.gross_r for t in gross_wins])) if gross_wins else 0.0
        avg_loss_gross_r = float(np.mean([abs(t.gross_r) for t in gross_losses])) if gross_losses else 0.0
        p_win_gross = len(gross_wins) / total
        p_loss_gross = len(gross_losses) / total
        gross_expectancy = (p_win_gross * avg_win_gross_r) - (p_loss_gross * avg_loss_gross_r)

        net_profit = final_cap - initial_cap
        net_profit_pct = (net_profit / initial_cap) * 100.0
        total_costs_deducted = sum(t.total_costs for t in trades)

        # -------------------------------------------------------------
        # Per-day breakdown
        # -------------------------------------------------------------
        by_day: Dict[str, Dict[str, Any]] = {}
        for t in trades:
            d_str = _extract_date_str(t.entry_time)
            if d_str not in by_day:
                by_day[d_str] = {
                    "date": d_str,
                    "trades": 0,
                    "wins": 0,
                    "losses": 0,
                    "gross_r": 0.0,
                    "net_r": 0.0,
                    "net_pnl": 0.0,
                    "costs": 0.0,
                }
            by_day[d_str]["trades"] += 1
            if t.net_pnl > 0:
                by_day[d_str]["wins"] += 1
            else:
                by_day[d_str]["losses"] += 1
            by_day[d_str]["gross_r"] = round(by_day[d_str]["gross_r"] + t.gross_r, 2)
            by_day[d_str]["net_r"] = round(by_day[d_str]["net_r"] + t.net_r, 2)
            by_day[d_str]["net_pnl"] = round(by_day[d_str]["net_pnl"] + t.net_pnl, 2)
            by_day[d_str]["costs"] = round(by_day[d_str]["costs"] + t.total_costs, 2)

        per_day_list = sorted(list(by_day.values()), key=lambda x: x["date"])

        # -------------------------------------------------------------
        # Per-symbol breakdown
        # -------------------------------------------------------------
        per_symbol_breakdown = [
            {
                "symbol": symbol,
                "trades": total,
                "wins": win_count,
                "losses": loss_count,
                "win_rate_pct": round(win_rate, 2),
                "gross_expectancy_r": round(gross_expectancy, 2),
                "net_expectancy_r": round(net_expectancy, 2),
                "net_pnl": round(net_profit, 2),
                "total_costs": round(total_costs_deducted, 2),
            }
        ]

        return BacktestMetrics(
            total_trades=total,
            win_trades=win_count,
            loss_trades=loss_count,
            square_off_trades=len(square_offs),
            win_rate_pct=round(win_rate, 2),
            avg_rr=round(avg_rr, 2),
            avg_win_r=round(avg_win_r, 2),
            avg_loss_r=round(avg_loss_r, 2),
            gross_expectancy_r=round(gross_expectancy, 2),
            net_expectancy_r=round(net_expectancy, 2),
            gross_profit_factor=round(gross_pf, 2),
            net_profit_factor=round(net_pf, 2),
            max_drawdown_r=round(max_dd_r, 2),
            max_drawdown_pct=round(max_dd_pct, 2),
            gross_profit=round(gross_profit_sum - gross_loss_sum, 2),
            net_profit=round(net_profit, 2),
            net_profit_pct=round(net_profit_pct, 2),
            total_costs=round(total_costs_deducted, 2),
            initial_capital=round(initial_cap, 2),
            final_capital=round(final_cap, 2),
            per_day_breakdown=per_day_list,
            per_symbol_breakdown=per_symbol_breakdown,
        )

    def export_reports(
        self,
        symbol: str,
        trade_type: str,
        metrics: BacktestMetrics,
        trades: List[BacktestTrade],
        output_dir: Path,
        asset_class: Optional[str] = None,
        exchange: Optional[str] = None,
    ) -> Dict[str, str]:
        """Saves trade list CSV, JSON results with per-day/per-symbol breakdown, Markdown, and HTML reports."""
        output_dir.mkdir(parents=True, exist_ok=True)
        eff_asset_class = (asset_class or self.config.asset_class or "equity").lower().strip()
        eff_exchange = (exchange or self.config.exchange or ("BINANCE" if eff_asset_class == "crypto" else "NSE")).upper()

        safe_sym = symbol.replace("/", "_").replace(":", "_")
        tag = f"{safe_sym}_{trade_type.lower()}"

        # 1. Export CSV
        csv_path = output_dir / f"trades_{tag}.csv"
        trade_dicts = [asdict(t) for t in trades]
        trade_df = pd.DataFrame(trade_dicts)
        trade_df.to_csv(csv_path, index=False)

        # 2. Export JSON results
        json_path = output_dir / f"results_{tag}.json"
        results_payload = {
            "symbol": symbol,
            "trade_type": trade_type,
            "asset_class": eff_asset_class,
            "exchange": eff_exchange,
            "config": asdict(self.config),
            "metrics": metrics.to_dict(),
            "trades": trade_dicts,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(results_payload, f, indent=2)

        # 3. Export Markdown Report
        md_path = output_dir / f"report_{tag}.md"
        md_content = self._generate_markdown_report(symbol, trade_type, metrics, trades, eff_asset_class)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)

        # 4. Export HTML Report
        html_path = output_dir / f"report_{tag}.html"
        html_content = self._generate_html_report(symbol, trade_type, metrics, trades, eff_asset_class)
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        return {
            "csv": str(csv_path),
            "json": str(json_path),
            "md": str(md_path),
            "html": str(html_path),
        }

    def _generate_markdown_report(
        self,
        symbol: str,
        trade_type: str,
        m: BacktestMetrics,
        trades: List[BacktestTrade],
        asset_class: str = "equity",
    ) -> str:
        cur = "$" if asset_class == "crypto" else "₹"
        rows = []
        for t in trades[:25]:
            rows.append(
                f"| {t.trade_id} | {t.side} | {t.entry_time[:16]} | {t.entry_price:.2f} | {t.exit_price:.2f} | {t.status} | {t.net_r:+.2f}R | {cur}{t.net_pnl:+.2f} | {cur}{t.total_costs:.2f} |"
            )
        trade_table = "\n".join(rows) if rows else "| No trades generated |"

        return f"""# SignalDesk Quant Report: {symbol} ({trade_type})

**Asset Class:** {asset_class.upper()} ({self.config.exchange})
**Cost Model:** NSE Cash Intraday MIS Statutory Taxes + {self.config.slippage_pct*100:.2f}% Slippage

## Performance Summary (Net of Real Costs)

| Metric | Net of Costs | Gross |
| :--- | :--- | :--- |
| **Expectancy (R)** | **{m.net_expectancy_r:+.2f} R** | **{m.gross_expectancy_r:+.2f} R** |
| **Win Rate** | **{m.win_rate_pct:.2f}%** ({m.win_trades}W / {m.loss_trades}L) | - |
| **Profit Factor** | **{m.net_profit_factor:.2f}** | {m.gross_profit_factor:.2f} |
| **Average Win / Loss** | **+{m.avg_win_r:.2f} R** / **-{m.avg_loss_r:.2f} R** | - |
| **Max Drawdown** | **{m.max_drawdown_r:.2f} R** ({m.max_drawdown_pct:.2f}%) | - |
| **Total Costs Deducted** | **{cur}{m.total_costs:,.2f}** | (Brokerage + STT + Turnover + GST + Slippage) |
| **Net Realized PnL** | **{cur}{m.net_profit:,.2f} ({m.net_profit_pct:+.2f}%)** | - |

## Recent Completed Trades (Sample)

| Trade ID | Side | Entry Time | Entry | Exit | Status | Net R | Net PnL | Costs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
{trade_table}
"""

    def _generate_html_report(
        self,
        symbol: str,
        trade_type: str,
        m: BacktestMetrics,
        trades: List[BacktestTrade],
        asset_class: str = "equity",
    ) -> str:
        cur = "$" if asset_class == "crypto" else "₹"
        trade_rows_html = "".join([
            f"<tr class='{'win' if t.net_pnl > 0 else 'loss'}'>"
            f"<td>{t.trade_id}</td><td>{t.side}</td><td>{t.entry_time[:16]}</td>"
            f"<td>{t.entry_price:.2f}</td><td>{t.exit_price:.2f}</td>"
            f"<td><b>{t.status}</b></td><td>{t.net_r:+.2f}R</td>"
            f"<td>{cur}{t.net_pnl:+.2f}</td><td>{cur}{t.total_costs:.2f}</td></tr>"
            for t in trades
        ])

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SignalDesk Quant Report &mdash; {symbol}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; }}
  .container {{ max-width: 1000px; margin: 0 auto; }}
  h1 {{ color: #14b8a6; margin-bottom: 4px; }}
  .badge {{ display: inline-block; padding: 4px 10px; background: #1e293b; border-radius: 6px; font-size: 13px; color: #94a3b8; margin-bottom: 20px; }}
  .cards {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }}
  .card {{ background: #1e293b; border: 1px solid #334155; padding: 16px; border-radius: 8px; }}
  .card-label {{ font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }}
  .card-val {{ font-size: 22px; font-weight: 700; margin-top: 6px; }}
  .pos {{ color: #4ade80; }}
  .neg {{ color: #f87171; }}
  table {{ width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; }}
  th, td {{ padding: 10px 14px; text-align: left; font-size: 13px; border-bottom: 1px solid #334155; }}
  th {{ background: #0f172a; color: #94a3b8; font-weight: 600; }}
  tr.win td:nth-child(7) {{ color: #4ade80; font-weight: 600; }}
  tr.loss td:nth-child(7) {{ color: #f87171; font-weight: 600; }}
</style>
</head>
<body>
<div class="container">
  <h1>SignalDesk Quant Report &mdash; {symbol}</h1>
  <div class="badge">Asset: {asset_class.upper()} ({self.config.exchange}) | Pipeline: {trade_type} | Statutory MIS Taxes + {self.config.slippage_pct*100:.2f}% Slippage</div>
  
  <div class="cards">
    <div class="card"><div class="card-label">Net Expectancy (R)</div><div class="card-val {'pos' if m.net_expectancy_r >= 0 else 'neg'}">{m.net_expectancy_r:+.2f} R</div></div>
    <div class="card"><div class="card-label">Win Rate</div><div class="card-val pos">{m.win_rate_pct:.1f}%</div></div>
    <div class="card"><div class="card-label">Net Profit Factor</div><div class="card-val">{m.net_profit_factor:.2f}</div></div>
    <div class="card"><div class="card-label">Net Profit</div><div class="card-val {'pos' if m.net_profit >= 0 else 'neg'}">{cur}{m.net_profit:,.2f}</div></div>
    <div class="card"><div class="card-label">Max Drawdown</div><div class="card-val neg">{m.max_drawdown_r:.2f} R</div></div>
    <div class="card"><div class="card-label">Costs Deducted</div><div class="card-val">{cur}{m.total_costs:,.2f}</div></div>
  </div>

  <h2>Completed Trades ({m.total_trades})</h2>
  <table>
    <thead>
      <tr><th>ID</th><th>Side</th><th>Entry Time</th><th>Entry</th><th>Exit</th><th>Status</th><th>Net R</th><th>Net PnL</th><th>Costs</th></tr>
    </thead>
    <tbody>
      {trade_rows_html if trade_rows_html else "<tr><td colspan='9'>No trades generated</td></tr>"}
    </tbody>
  </table>
</div>
</body>
</html>
"""
