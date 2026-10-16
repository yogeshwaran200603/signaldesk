# SignalDesk Backtest Report: IDEA (INTRADAY)

**Execution Timestamp:** 2026-10-06 14:35:15

## Performance Summary

| Metric | Result |
| :--- | :--- |
| **Total Trades** | 33 |
| **Win Trades / Loss Trades** | 15 / 18 |
| **Win Rate** | **45.45%** |
| **Average RR** | **1:2.51** |
| **Profit Factor** | **1.24** |
| **Expectancy / Trade** | ₹174.64 |
| **Max Drawdown** | 5.48% |
| **Initial Capital** | ₹100,000.00 |
| **Final Capital** | ₹105,763.15 |
| **Net Profit** | **₹5,763.15 (5.76%)** |

## Strategy & Assumptions
- **Strategy Concept:** Smart Money Concepts (SMC) + Volume Profile + Candlestick Confluence
- **Risk Management:** 1:2 Minimum Risk-Reward, 1% Risk per Trade
- **Friction:** Brokerage 0.05% + Slippage 0.05% per side
- **SL vs TP Conflict:** SL checked first if both extremes touched in same candle

## Recent Trades (Sample)

| Trade ID | Side | Entry Time | Entry | SL | TP | Status | RR | PnL |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SIG_IDEA_B74332B9 | SELL | 2026-07-15 09:15:00+05:30 | 13.97 | 14.09 | 13.76 | TP HIT | 2.0 | ₹1691.92 |
| SIG_IDEA_D0337318 | SELL | 2026-07-15 15:25:00+05:30 | 13.78 | 13.89 | 13.55 | SL HIT | 2.4 | ₹-1361.02 |
| SIG_IDEA_AC330A7B | BUY | 2026-07-16 13:25:00+05:30 | 13.86 | 13.75 | 14.05 | SL HIT | 2.0 | ₹-1342.42 |
| SIG_IDEA_37720802 | SELL | 2026-07-23 11:10:00+05:30 | 13.47 | 13.6 | 13.24 | TP HIT | 2.0 | ₹1704.57 |
| SIG_IDEA_C8A2A357 | SELL | 2026-07-29 09:20:00+05:30 | 13.12 | 13.23 | 12.91 | TP HIT | 2.2 | ₹1882.70 |
| SIG_IDEA_CC02F7CD | SELL | 2026-08-05 09:45:00+05:30 | 12.98 | 13.1 | 12.75 | TP HIT | 2.18 | ₹1931.49 |
| SIG_IDEA_B28A7953 | SELL | 2026-08-07 12:25:00+05:30 | 12.83 | 12.94 | 12.6 | SL HIT | 2.4 | ₹-1388.70 |
| SIG_IDEA_C74993B1 | BUY | 2026-08-11 14:10:00+05:30 | 12.98 | 12.87 | 13.3 | SL HIT | 3.3 | ₹-1370.54 |
| SIG_IDEA_B731614E | BUY | 2026-08-12 11:05:00+05:30 | 13.44 | 13.31 | 13.69 | SL HIT | 2.17 | ₹-1300.42 |
| SIG_IDEA_00B507DF | BUY | 2026-08-12 11:25:00+05:30 | 13.28 | 13.1 | 13.69 | TP HIT | 2.47 | ₹2283.56 |
| SIG_IDEA_6562A100 | BUY | 2026-08-13 12:00:00+05:30 | 13.67 | 13.56 | 13.88 | SL HIT | 2.2 | ₹-1372.58 |
| SIG_IDEA_D5764A47 | BUY | 2026-08-13 13:50:00+05:30 | 13.58 | 13.47 | 13.88 | TP HIT | 3.1 | ₹2800.05 |
| SIG_IDEA_BAD5F3B1 | BUY | 2026-08-14 10:35:00+05:30 | 14.0 | 13.86 | 14.28 | SL HIT | 2.23 | ₹-1313.37 |
| SIG_IDEA_1A1FB9EB | BUY | 2026-08-17 10:45:00+05:30 | 13.88 | 13.77 | 14.12 | SL HIT | 2.5 | ₹-1376.20 |
| SIG_IDEA_A49AE0EF | BUY | 2026-08-17 13:25:00+05:30 | 13.78 | 13.67 | 14.16 | SL HIT | 3.9 | ₹-1356.72 |
| SIG_IDEA_E95E8C95 | BUY | 2026-08-18 09:15:00+05:30 | 13.63 | 13.52 | 13.89 | SL HIT | 2.7 | ₹-1337.17 |
| SIG_IDEA_D9E284D3 | BUY | 2026-08-19 10:25:00+05:30 | 13.97 | 13.86 | 14.18 | TP HIT | 2.2 | ₹1836.43 |
| SIG_IDEA_16AB3EAA | BUY | 2026-08-20 13:30:00+05:30 | 14.0 | 13.89 | 14.19 | TP HIT | 2.0 | ₹1669.22 |
| SIG_IDEA_4FDC1842 | BUY | 2026-08-26 13:15:00+05:30 | 15.11 | 15.0 | 15.37 | SL HIT | 2.7 | ₹-1381.29 |
| SIG_IDEA_E52991CA | BUY | 2026-08-27 10:55:00+05:30 | 14.99 | 14.88 | 15.18 | SL HIT | 2.0 | ₹-1361.31 |
| SIG_IDEA_C6BDE407 | SELL | 2026-08-31 09:30:00+05:30 | 14.9 | 15.04 | 14.63 | TP HIT | 2.15 | ₹1877.48 |
| SIG_IDEA_9C6E7CE5 | SELL | 2026-09-02 10:15:00+05:30 | 14.58 | 14.8 | 13.93 | SL HIT | 3.14 | ₹-1181.63 |
| SIG_IDEA_08C3B9E5 | BUY | 2026-09-08 12:10:00+05:30 | 15.47 | 15.36 | 15.68 | SL HIT | 2.2 | ₹-1357.21 |
| SIG_IDEA_80957BBE | BUY | 2026-09-09 09:15:00+05:30 | 15.25 | 15.14 | 15.54 | TP HIT | 3.0 | ₹2616.20 |
| SIG_IDEA_C60942E9 | SELL | 2026-09-10 10:20:00+05:30 | 15.33 | 15.44 | 15.08 | TP HIT | 2.6 | ₹2281.39 |
| SIG_IDEA_74889F69 | SELL | 2026-09-22 10:10:00+05:30 | 14.06 | 14.19 | 13.71 | SL HIT | 3.0 | ₹-1332.76 |
| SIG_IDEA_F4CF71B4 | SELL | 2026-09-22 10:15:00+05:30 | 14.16 | 14.3 | 13.71 | SL HIT | 3.54 | ₹-1294.17 |
| SIG_IDEA_F8E999FC | SELL | 2026-09-22 10:20:00+05:30 | 14.22 | 14.37 | 13.71 | SL HIT | 3.71 | ₹-1259.14 |
| SIG_IDEA_68181AFD | BUY | 2026-09-25 10:25:00+05:30 | 14.16 | 14.04 | 14.38 | TP HIT | 2.09 | ₹1777.27 |
| SIG_IDEA_213AA985 | SELL | 2026-09-29 09:15:00+05:30 | 13.64 | 13.76 | 13.43 | TP HIT | 2.0 | ₹1723.26 |

*Generated automatically by SignalDesk Quantitative Backtesting Engine.*
