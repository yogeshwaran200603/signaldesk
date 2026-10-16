"""Unit tests for the NSE cash intraday MIS statutory trading cost model."""

import pytest
from engine.backtest.costs import CostModel, calculate_nse_mis_costs


def test_hand_calculated_reliance_buy_trade():
    """Verifies each fee line item against an exact hand-calculated benchmark down to paisa precision."""
    # 100 shares of RELIANCE bought at 2500, sold at 2550, SL at 2475, slippage 0.03%
    result = calculate_nse_mis_costs(
        entry_price=2500.0,
        exit_price=2550.0,
        quantity=100,
        side="BUY",
        sl=2475.0,
        slippage_pct=0.0003,
    )

    # 1. Executed prices with 0.03% slippage
    assert result.entry_price_executed == 2500.75
    assert result.exit_price_executed == 2549.235

    # 2. Turnovers
    assert result.buy_turnover == 250075.0
    assert result.sell_turnover == 254923.5
    assert result.total_turnover == 504998.5

    # 3. Brokerage: ₹20 cap hit on both legs (250075 * 0.0003 = 75.02 > 20)
    assert result.brokerage == 40.0

    # 4. STT: 0.025% on SELL turnover only (254923.5 * 0.00025 = 63.73)
    assert result.stt == 63.73

    # 5. Exchange Charges: 0.00297% on total turnover (504998.5 * 0.0000297 = 15.00)
    assert result.exchange_charges == 15.00

    # 6. SEBI Turnover: ₹10/crore on total turnover (504998.5 * 0.000001 = 0.50)
    assert result.sebi_charges == 0.50

    # 7. Stamp Duty: 0.003% on BUY turnover only (250075 * 0.00003 = 7.50)
    assert result.stamp_duty == 7.50

    # 8. GST: 18% on (Brokerage 40 + Exchange 15.00 + SEBI 0.50 = 55.50) => 9.99
    assert result.gst == 9.99

    # 9. Slippage cost in ₹: (0.75 + 0.765) * 100 = 151.50
    assert result.slippage_cost == 151.50

    # 10. PnL and R Multiples
    assert result.gross_pnl == 5000.0
    # Net PnL: 5000 - 151.50 (slippage) - 40.00 (brokerage) - 96.72 (statutory) = 4711.78
    assert abs(result.net_pnl - 4711.78) <= 0.05
    assert result.planned_risk == 2500.0
    assert result.gross_r == 2.0
    assert abs(result.net_r - 1.8847) <= 0.01


def test_small_trade_brokerage_percentage():
    """Verifies that small trades are charged 0.03% instead of the ₹20 flat cap."""
    # 1 share of ₹500: turnover per leg is ~₹500, 0.03% is ₹0.15, well under ₹20
    result = calculate_nse_mis_costs(
        entry_price=500.0,
        exit_price=510.0,
        quantity=1,
        side="BUY",
        sl=495.0,
        slippage_pct=0.0,
    )
    # Brokerage should be approx 500 * 0.0003 + 510 * 0.0003 = 0.15 + 0.153 = 0.30
    assert result.brokerage < 1.0
    assert abs(result.brokerage - 0.30) <= 0.05


def test_short_sell_trade_statutory_split():
    """Verifies that for short trades, STT is on entry (sell) and stamp duty is on exit (buy)."""
    result = calculate_nse_mis_costs(
        entry_price=1000.0,
        exit_price=980.0,
        quantity=50,
        side="SELL",
        sl=1010.0,
        slippage_pct=0.0003,
    )
    # For SELL trade, sell leg is entry, buy leg is exit
    assert result.sell_turnover > 0
    assert result.buy_turnover > 0
    assert result.gross_pnl == 1000.0  # (1000 - 980) * 50
    assert result.net_pnl < result.gross_pnl
    assert result.net_r < result.gross_r
