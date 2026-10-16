"""Trading cost model for Indian Markets (NSE Cash Intraday MIS) and multi-asset trading.

Calculates exact statutory taxes and exchange fees:
- Brokerage: min(flat_cap, percent * turnover) per executed leg
- STT (Securities Transaction Tax): 0.025% on SELL turnover only for equity intraday
- Exchange Transaction Charges: 0.00297% on both buy and sell turnover
- SEBI Turnover Charges: ₹10 per crore (0.0001%) on both buy and sell turnover
- Stamp Duty: 0.003% on BUY turnover only for intraday cash
- GST: 18% on (Brokerage + Exchange Charges + SEBI Charges)
- Slippage: Configurable default 0.03% on entry and exit prices
"""

from dataclasses import asdict, dataclass
import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger("signaldesk.costs")
DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "trading_costs.json"


@dataclass
class CostBreakdown:
    entry_price_raw: float
    exit_price_raw: float
    entry_price_executed: float
    exit_price_executed: float
    quantity: float
    side: str
    buy_turnover: float
    sell_turnover: float
    total_turnover: float
    brokerage: float
    stt: float
    exchange_charges: float
    sebi_charges: float
    stamp_duty: float
    gst: float
    slippage_cost: float
    total_statutory_taxes: float
    total_costs: float
    gross_pnl: float
    net_pnl: float
    gross_r: float
    net_r: float
    planned_risk: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class CostModel:
    """Manages rates and executes cost deductions according to trading_costs.json."""

    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or DEFAULT_CONFIG_PATH
        self.config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as exc:
                logger.warning(f"Could not load cost config from {self.config_path}: {exc}. Using defaults.")
        return {
            "nse_equity_intraday": {
                "brokerage": {"percent": 0.0003, "flat_cap_per_order": 20.0},
                "stt": {"sell_percent": 0.00025, "buy_percent": 0.0},
                "exchange_transaction_charge": {"percent": 0.0000297},
                "sebi_turnover_charge": {"percent": 0.000001},
                "stamp_duty": {"buy_percent": 0.00003, "sell_percent": 0.0},
                "gst": {"percent": 0.18},
                "slippage": {"default_percent": 0.0003},
            },
            "crypto_spot": {
                "brokerage": {"percent": 0.0010},
                "slippage": {"default_percent": 0.0005},
            },
        }

    def calculate_costs(
        self,
        entry_price: float,
        exit_price: float,
        quantity: float,
        side: str = "BUY",
        sl: Optional[float] = None,
        asset_class: str = "equity",
        slippage_pct: Optional[float] = None,
    ) -> CostBreakdown:
        """Calculates itemized statutory fees, brokerage, slippage, and net PnL."""
        side_upper = side.upper().strip()
        asset_class_lower = asset_class.lower().strip()
        qty = max(0.000001, float(quantity))

        if asset_class_lower == "crypto":
            return self._calculate_crypto_costs(
                entry_price, exit_price, qty, side_upper, sl, slippage_pct
            )
        return self._calculate_nse_mis_costs(
            entry_price, exit_price, qty, side_upper, sl, slippage_pct
        )

    def _calculate_nse_mis_costs(
        self,
        entry_price: float,
        exit_price: float,
        quantity: float,
        side: str,
        sl: Optional[float] = None,
        slippage_pct: Optional[float] = None,
    ) -> CostBreakdown:
        cfg = self.config.get("nse_equity_intraday", {})
        slip_rate = (
            slippage_pct
            if slippage_pct is not None
            else cfg.get("slippage", {}).get("default_percent", 0.0003)
        )

        # Apply slippage: trader enters worse, exits worse
        if side == "BUY":
            entry_executed = entry_price * (1.0 + slip_rate)
            exit_executed = exit_price * (1.0 - slip_rate)
            buy_turnover = entry_executed * quantity
            sell_turnover = exit_executed * quantity
            gross_pnl = (exit_price - entry_price) * quantity
        else:  # SELL (Short intraday)
            entry_executed = entry_price * (1.0 - slip_rate)
            exit_executed = exit_price * (1.0 + slip_rate)
            sell_turnover = entry_executed * quantity
            buy_turnover = exit_executed * quantity
            gross_pnl = (entry_price - exit_price) * quantity

        total_turnover = buy_turnover + sell_turnover

        # 1. Brokerage: min(cap, turnover * rate) per order leg
        brok_cfg = cfg.get("brokerage", {})
        brok_rate = brok_cfg.get("percent", 0.0003)
        brok_cap = brok_cfg.get("flat_cap_per_order", 20.0)
        brokerage_entry = min(brok_cap, (entry_executed * quantity) * brok_rate)
        brokerage_exit = min(brok_cap, (exit_executed * quantity) * brok_rate)
        total_brokerage = brokerage_entry + brokerage_exit

        # 2. STT: on SELL turnover only for intraday equity
        stt_rate = cfg.get("stt", {}).get("sell_percent", 0.00025)
        stt = sell_turnover * stt_rate

        # 3. Exchange Transaction Charges: on both legs
        exc_rate = cfg.get("exchange_transaction_charge", {}).get("percent", 0.0000297)
        exchange_charges = total_turnover * exc_rate

        # 4. SEBI Turnover Charges: ₹10 per crore (0.0001%) on both legs
        sebi_rate = cfg.get("sebi_turnover_charge", {}).get("percent", 0.000001)
        sebi_charges = total_turnover * sebi_rate

        # 5. Stamp Duty: 0.003% on BUY turnover only for intraday cash
        stamp_rate = cfg.get("stamp_duty", {}).get("buy_percent", 0.00003)
        stamp_duty = buy_turnover * stamp_rate

        # 6. GST: 18% on (Brokerage + Exchange Charges + SEBI Charges)
        gst_rate = cfg.get("gst", {}).get("percent", 0.18)
        gst_taxable = total_brokerage + exchange_charges + sebi_charges
        gst = gst_taxable * gst_rate

        # 7. Slippage cost in rupees
        slippage_cost = (
            abs(entry_executed - entry_price) + abs(exit_executed - exit_price)
        ) * quantity

        total_statutory = stt + exchange_charges + sebi_charges + stamp_duty + gst
        total_costs = total_brokerage + total_statutory + slippage_cost

        # Realized net PnL
        if side == "BUY":
            realized_pnl = (exit_executed - entry_executed) * quantity
        else:
            realized_pnl = (entry_executed - exit_executed) * quantity
        net_pnl = realized_pnl - (total_brokerage + total_statutory)

        # R Multiples
        if sl is not None and abs(entry_price - sl) > 0:
            planned_risk = abs(entry_price - sl) * quantity
        else:
            planned_risk = max(1.0, entry_price * quantity * 0.01)

        gross_r = round(gross_pnl / planned_risk, 4) if planned_risk > 0 else 0.0
        net_r = round(net_pnl / planned_risk, 4) if planned_risk > 0 else 0.0

        return CostBreakdown(
            entry_price_raw=round(entry_price, 2),
            exit_price_raw=round(exit_price, 2),
            entry_price_executed=round(entry_executed, 4),
            exit_price_executed=round(exit_executed, 4),
            quantity=round(quantity, 4),
            side=side,
            buy_turnover=round(buy_turnover, 2),
            sell_turnover=round(sell_turnover, 2),
            total_turnover=round(total_turnover, 2),
            brokerage=round(total_brokerage, 2),
            stt=round(stt, 2),
            exchange_charges=round(exchange_charges, 2),
            sebi_charges=round(sebi_charges, 2),
            stamp_duty=round(stamp_duty, 2),
            gst=round(gst, 2),
            slippage_cost=round(slippage_cost, 2),
            total_statutory_taxes=round(total_statutory, 2),
            total_costs=round(total_costs, 2),
            gross_pnl=round(gross_pnl, 2),
            net_pnl=round(net_pnl, 2),
            gross_r=gross_r,
            net_r=net_r,
            planned_risk=round(planned_risk, 2),
        )

    def _calculate_crypto_costs(
        self,
        entry_price: float,
        exit_price: float,
        quantity: float,
        side: str,
        sl: Optional[float] = None,
        slippage_pct: Optional[float] = None,
    ) -> CostBreakdown:
        cfg = self.config.get("crypto_spot", {})
        slip_rate = (
            slippage_pct
            if slippage_pct is not None
            else cfg.get("slippage", {}).get("default_percent", 0.0005)
        )
        brok_rate = cfg.get("brokerage", {}).get("percent", 0.0010)

        if side == "BUY":
            entry_executed = entry_price * (1.0 + slip_rate)
            exit_executed = exit_price * (1.0 - slip_rate)
            gross_pnl = (exit_price - entry_price) * quantity
            realized_pnl = (exit_executed - entry_executed) * quantity
        else:
            entry_executed = entry_price * (1.0 - slip_rate)
            exit_executed = exit_price * (1.0 + slip_rate)
            gross_pnl = (entry_price - exit_price) * quantity
            realized_pnl = (entry_executed - exit_executed) * quantity

        entry_turnover = entry_executed * quantity
        exit_turnover = exit_executed * quantity
        total_turnover = entry_turnover + exit_turnover
        brokerage = total_turnover * brok_rate
        slippage_cost = (
            abs(entry_executed - entry_price) + abs(exit_executed - exit_price)
        ) * quantity
        net_pnl = realized_pnl - brokerage

        if sl is not None and abs(entry_price - sl) > 0:
            planned_risk = abs(entry_price - sl) * quantity
        else:
            planned_risk = max(1.0, entry_price * quantity * 0.01)

        gross_r = round(gross_pnl / planned_risk, 4) if planned_risk > 0 else 0.0
        net_r = round(net_pnl / planned_risk, 4) if planned_risk > 0 else 0.0

        return CostBreakdown(
            entry_price_raw=round(entry_price, 4),
            exit_price_raw=round(exit_price, 4),
            entry_price_executed=round(entry_executed, 4),
            exit_price_executed=round(exit_executed, 4),
            quantity=round(quantity, 6),
            side=side,
            buy_turnover=round(entry_turnover if side == "BUY" else exit_turnover, 2),
            sell_turnover=round(exit_turnover if side == "BUY" else entry_turnover, 2),
            total_turnover=round(total_turnover, 2),
            brokerage=round(brokerage, 2),
            stt=0.0,
            exchange_charges=0.0,
            sebi_charges=0.0,
            stamp_duty=0.0,
            gst=0.0,
            slippage_cost=round(slippage_cost, 2),
            total_statutory_taxes=0.0,
            total_costs=round(brokerage + slippage_cost, 2),
            gross_pnl=round(gross_pnl, 2),
            net_pnl=round(net_pnl, 2),
            gross_r=gross_r,
            net_r=net_r,
            planned_risk=round(planned_risk, 2),
        )


cost_model = CostModel()


def calculate_nse_mis_costs(
    entry_price: float,
    exit_price: float,
    quantity: float,
    side: str = "BUY",
    sl: Optional[float] = None,
    slippage_pct: Optional[float] = None,
) -> CostBreakdown:
    """Convenience functional wrapper around the singleton CostModel for NSE cash intraday."""
    return cost_model.calculate_costs(
        entry_price=entry_price,
        exit_price=exit_price,
        quantity=quantity,
        side=side,
        sl=sl,
        asset_class="equity",
        slippage_pct=slippage_pct,
    )
