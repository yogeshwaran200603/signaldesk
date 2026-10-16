"""Analytics and performance calculation module for SignalDesk API (Phase 1 Upgraded).

Computes quantitative risk and performance statistics net of real statutory costs:
- Total trades, Wins, Losses, 15:15 Square-Offs, Win Rate %
- Average Risk-Reward ratio
- Gross and Net Profit Factor
- Mathematical Expectancy per setup in R (Gross and Net of Costs)
- Maximum Drawdown (in R from peak equity)
- Cumulative Gross vs Net Equity Curves over time
"""

from datetime import datetime
import logging
from typing import Any, Dict, List, Optional
import numpy as np
from fastapi import HTTPException

from engine.data import firebase_client

logger = logging.getLogger("signaldesk.analytics")


def verify_auth_uid(authorization: Optional[str]) -> str:
    """Extracts and verifies Firebase user ID from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please pass 'Authorization: Bearer <Firebase_ID_Token>'.",
        )

    token = authorization.split("Bearer ", 1)[1].strip()
    try:
        claims = firebase_client.verify_firebase_token(token)
        uid = claims.get("uid")
        if not uid:
            raise HTTPException(status_code=401, detail="Invalid token payload: missing uid claim.")
        return uid
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(f"Failed to verify ID token: {exc}")
        raise HTTPException(status_code=401, detail=f"Invalid or expired Firebase ID token: {exc}")


def calculate_performance_metrics(outcomes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculates quantitative risk and performance statistics from signal outcomes list."""
    if not outcomes:
        return {
            "total_trades": 0,
            "win_trades": 0,
            "loss_trades": 0,
            "square_off_trades": 0,
            "open_trades": 0,
            "win_rate_pct": 0.0,
            "avg_rr": 0.0,
            "gross_expectancy_r": 0.0,
            "net_expectancy_r": 0.0,
            "expectancy_r": 0.0,  # backwards compatibility alias
            "gross_profit_factor": 0.0,
            "net_profit_factor": 0.0,
            "profit_factor": 0.0,  # backwards compatibility alias
            "max_drawdown_r": 0.0,
            "net_pnl_r": 0.0,
            "gross_pnl_r": 0.0,
            "total_costs_deducted": 0.0,
            "per_stock": [],
        }

    closed_statuses = ("TP HIT", "SL HIT", "SQUARE_OFF_315")
    closed_trades = [o for o in outcomes if o.get("status") in closed_statuses]
    open_trades = [o for o in outcomes if o.get("status") == "OPEN"]
    square_offs = [o for o in closed_trades if o.get("status") == "SQUARE_OFF_315"]

    if not closed_trades:
        return {
            "total_trades": len(outcomes),
            "win_trades": 0,
            "loss_trades": 0,
            "square_off_trades": 0,
            "open_trades": len(open_trades),
            "win_rate_pct": 0.0,
            "avg_rr": 0.0,
            "gross_expectancy_r": 0.0,
            "net_expectancy_r": 0.0,
            "expectancy_r": 0.0,
            "gross_profit_factor": 0.0,
            "net_profit_factor": 0.0,
            "profit_factor": 0.0,
            "max_drawdown_r": 0.0,
            "net_pnl_r": 0.0,
            "gross_pnl_r": 0.0,
            "total_costs_deducted": 0.0,
            "per_stock": [],
        }

    # Extract net_r and gross_r with fallback
    def _get_net_r(t: Dict[str, Any]) -> float:
        if "net_r" in t and t["net_r"] is not None:
            return float(t["net_r"])
        return float(t.get("pnl_r", 2.0 if t.get("status") == "TP HIT" else -1.0))

    def _get_gross_r(t: Dict[str, Any]) -> float:
        if "gross_r" in t and t["gross_r"] is not None:
            return float(t["gross_r"])
        return float(t.get("rr", 2.0) if t.get("status") == "TP HIT" else -1.0)

    wins = [t for t in closed_trades if _get_net_r(t) > 0]
    losses = [t for t in closed_trades if _get_net_r(t) <= 0]

    win_count = len(wins)
    loss_count = len(losses)
    total_closed = len(closed_trades)
    win_rate = round((win_count / total_closed) * 100.0, 2) if total_closed > 0 else 0.0

    rr_values = [float(o.get("rr", 2.0)) for o in wins if float(o.get("rr", 0)) > 0]
    avg_rr = round(float(np.mean(rr_values)), 2) if rr_values else 2.0

    # Net R calculations
    gross_win_r = sum(_get_net_r(t) for t in wins)
    gross_loss_r = sum(abs(_get_net_r(t)) for t in losses)
    net_pnl_r = round(gross_win_r - gross_loss_r, 2)
    net_pf = round(gross_win_r / gross_loss_r, 2) if gross_loss_r > 0 else (99.0 if gross_win_r > 0 else 0.0)

    # Gross R calculations
    gross_wins = [t for t in closed_trades if _get_gross_r(t) > 0]
    gross_losses = [t for t in closed_trades if _get_gross_r(t) <= 0]
    gross_win_sum = sum(_get_gross_r(t) for t in gross_wins)
    gross_loss_sum = sum(abs(_get_gross_r(t)) for t in gross_losses)
    gross_pnl_r = round(gross_win_sum - gross_loss_sum, 2)
    gross_pf = round(gross_win_sum / gross_loss_sum, 2) if gross_loss_sum > 0 else (99.0 if gross_win_sum > 0 else 0.0)

    # Expectancy in R: (Win% * AvgWinR) - (Loss% * AvgLossR)
    avg_win_net_r = (gross_win_r / win_count) if win_count > 0 else 0.0
    avg_loss_net_r = (gross_loss_r / loss_count) if loss_count > 0 else 0.0
    p_win = win_rate / 100.0
    p_loss = (100.0 - win_rate) / 100.0
    net_expectancy = round((p_win * avg_win_net_r) - (p_loss * avg_loss_net_r), 2)

    avg_win_gross_r = (gross_win_sum / len(gross_wins)) if gross_wins else 0.0
    avg_loss_gross_r = (gross_loss_sum / len(gross_losses)) if gross_losses else 0.0
    p_win_g = len(gross_wins) / total_closed if total_closed > 0 else 0.0
    p_loss_g = len(gross_losses) / total_closed if total_closed > 0 else 0.0
    gross_expectancy = round((p_win_g * avg_win_gross_r) - (p_loss_g * avg_loss_gross_r), 2)

    # Costs total
    total_costs = round(sum(float(t.get("total_costs", 0.0)) for t in closed_trades), 2)

    # Max Drawdown in R (peak-to-trough on cumulative net equity curve)
    sorted_trades = sorted(
        closed_trades,
        key=lambda x: str(x.get("opened_at") or x.get("closed_at") or x.get("recorded_at") or ""),
    )
    running_net = 0.0
    peak_net = 0.0
    max_dd = 0.0

    for t in sorted_trades:
        r_val = _get_net_r(t)
        running_net += r_val
        if running_net > peak_net:
            peak_net = running_net
        dd = peak_net - running_net
        if dd > max_dd:
            max_dd = dd

    max_drawdown_r = round(max_dd, 2)

    # Per-stock aggregation
    by_stock: Dict[str, Dict[str, Any]] = {}
    for t in closed_trades:
        sym = t.get("symbol", "UNKNOWN")
        if sym not in by_stock:
            by_stock[sym] = {"symbol": sym, "total": 0, "wins": 0, "losses": 0, "net_pnl_r": 0.0, "total_costs": 0.0}
        by_stock[sym]["total"] += 1
        r_val = _get_net_r(t)
        by_stock[sym]["net_pnl_r"] = round(by_stock[sym]["net_pnl_r"] + r_val, 2)
        by_stock[sym]["total_costs"] = round(by_stock[sym]["total_costs"] + float(t.get("total_costs", 0.0)), 2)
        if r_val > 0:
            by_stock[sym]["wins"] += 1
        else:
            by_stock[sym]["losses"] += 1

    per_stock_list = []
    for s_data in by_stock.values():
        tot = s_data["total"]
        w = s_data["wins"]
        s_data["win_rate_pct"] = round((w / tot) * 100.0, 1) if tot > 0 else 0.0
        per_stock_list.append(s_data)

    per_stock_list.sort(key=lambda x: x["net_pnl_r"], reverse=True)

    return {
        "total_trades": total_closed,
        "win_trades": win_count,
        "loss_trades": loss_count,
        "square_off_trades": len(square_offs),
        "open_trades": len(open_trades),
        "win_rate_pct": win_rate,
        "avg_rr": avg_rr,
        "gross_expectancy_r": gross_expectancy,
        "net_expectancy_r": net_expectancy,
        "expectancy_r": net_expectancy,  # alias
        "gross_profit_factor": gross_pf,
        "net_profit_factor": net_pf,
        "profit_factor": net_pf,  # alias
        "max_drawdown_r": max_drawdown_r,
        "net_pnl_r": net_pnl_r,
        "gross_pnl_r": gross_pnl_r,
        "total_costs_deducted": total_costs,
        "per_stock": per_stock_list,
    }


def build_equity_curve(
    outcomes: List[Dict[str, Any]],
    trade_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Generates sequential cumulative R data points (both Gross and Net of Costs)."""
    closed_statuses = ("TP HIT", "SL HIT", "SQUARE_OFF_315")
    filtered = [o for o in outcomes if o.get("status") in closed_statuses]
    if trade_type and trade_type.upper() != "ALL":
        filtered = [o for o in filtered if str(o.get("trade_type", "")).upper() == trade_type.upper()]

    filtered.sort(key=lambda x: str(x.get("opened_at") or x.get("closed_at") or x.get("recorded_at") or ""))

    curve = []
    cumulative_net_r = 0.0
    cumulative_gross_r = 0.0

    for idx, t in enumerate(filtered):
        net_r = float(t.get("net_r", t.get("pnl_r", 2.0 if t.get("status") == "TP HIT" else -1.0)))
        gross_r = float(t.get("gross_r", t.get("rr", 2.0) if t.get("status") == "TP HIT" else -1.0))
        costs = float(t.get("total_costs", 0.0))

        cumulative_net_r = round(cumulative_net_r + net_r, 2)
        cumulative_gross_r = round(cumulative_gross_r + gross_r, 2)

        ts = t.get("closed_at") or t.get("recorded_at") or t.get("opened_at") or datetime.now().isoformat()
        curve.append(
            {
                "trade_index": idx + 1,
                "date": str(ts),
                "symbol": t.get("symbol", ""),
                "trade_type": t.get("trade_type", "INTRADAY"),
                "status": t.get("status", ""),
                "exit_reason": t.get("exit_reason", ""),
                "gross_r": gross_r,
                "net_r": net_r,
                "cumulative_gross_r": cumulative_gross_r,
                "cumulative_net_r": cumulative_net_r,
                "cumulative_r": cumulative_net_r,  # alias for backwards compatibility
                "total_costs": costs,
            }
        )

    return curve
