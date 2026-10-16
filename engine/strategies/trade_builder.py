"""Trade builder module for SignalDesk.

Converts validated confluence setup candidates into actionable trade signals:
- Entry at OB / FVG zone
- SL placed beyond OB / swing structure with ATR buffer
- TP aimed at next opposing liquidity pool
- Strict Risk-Reward filter: Rejects any setup with RR < 1:2 (2.0)
- Confidence score (0-100) computed based on confluence factors and structural alignment
"""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
import uuid

from engine.strategies.confluence import SetupCandidate


@dataclass
class TradeSignal:
    id: str
    symbol: str
    tradeType: Literal["INTRADAY", "DELIVERY", "SCALP", "SWING"]
    side: Literal["BUY", "SELL"]
    entry: float
    sl: float
    tp: float
    rr: float
    confidence: int
    timeframes: Dict[str, str]
    reasons: List[str]
    assetClass: str = "equity"
    exchange: str = "NSE"
    status: Literal["OPEN", "TP HIT", "SL HIT", "CANCELLED"] = "OPEN"
    createdAt: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    closedAt: Optional[str] = None
    exitPrice: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _round_price(price: float, asset_class: str = "equity") -> float:
    """Adaptive price rounding for equities (2 decimals) and crypto (2 to 6 decimals)."""
    p = float(price)
    if (asset_class or "equity").lower() == "crypto":
        decimals = 6 if abs(p) < 1.0 else (4 if abs(p) < 10.0 else 2)
        return round(p, decimals)
    return round(p, 2)


def build_trade_signal(
    candidate: SetupCandidate,
    asset_class: Optional[str] = None,
    exchange: Optional[str] = None,
) -> Optional[TradeSignal]:
    """Builds and validates a trade signal from a confluence candidate.

    Rejects any setup where:
    - SL and Entry are invalid
    - Risk-to-Reward ratio is strictly below 2.0 (1:2)
    """
    if candidate is None:
        return None

    entry = float(candidate.entry_price)
    decimals = 6 if entry < 1.0 else (4 if entry < 10.0 else 2)
    min_atr = 0.0001 if entry < 1.0 else (0.001 if entry < 10.0 else 0.1)
    atr = max(min_atr, float(candidate.atr))
    atr_buffer = 0.5 * atr

    if candidate.side == "BUY":
        # SL below the OB bottom or ATR-buffered level
        zone_bottom = min(candidate.ob_or_key_zone[0], entry - 0.5 * atr)
        sl = round(zone_bottom - atr_buffer, decimals)

        # TP at next opposing liquidity level
        target_level = float(candidate.opposing_target_level)
        tp = round(target_level, decimals)

        risk = entry - sl
        reward = tp - entry

        if risk <= 0:
            return None

        rr = reward / risk

        # Reject setups with RR < 1:2
        if rr < 2.0:
            return None

    else:  # SELL
        # SL above the OB top or ATR-buffered level
        zone_top = max(candidate.ob_or_key_zone[1], entry + 0.5 * atr)
        sl = round(zone_top + atr_buffer, decimals)

        # TP at next opposing liquidity pool
        target_level = float(candidate.opposing_target_level)
        tp = round(target_level, decimals)

        risk = sl - entry
        reward = entry - tp

        if risk <= 0:
            return None

        rr = reward / risk

        # Reject setups with RR < 1:2
        if rr < 2.0:
            return None

    # Compute confidence score (0-100)
    base_scores = {3: 65, 4: 75, 5: 85, 6: 90, 7: 94}
    conf = base_scores.get(candidate.confluence_count, 94 if candidate.confluence_count > 7 else 60)

    # Bonus points for exceptional Risk-Reward
    if rr >= 2.5:
        conf += 2
    if rr >= 3.0:
        conf += 2

    # Clamp confidence between 50 and 96 (never claim 100% certainty)
    confidence_score = max(50, min(96, int(conf)))

    clean_sym_id = str(candidate.symbol).replace("/", "_")
    signal_id = f"SIG_{clean_sym_id}_{uuid.uuid4().hex[:8].upper()}"

    eff_asset_class = asset_class or getattr(candidate, "asset_class", "equity")
    eff_exchange = exchange or getattr(candidate, "exchange", "NSE")

    return TradeSignal(
        id=signal_id,
        symbol=candidate.symbol,
        tradeType=candidate.trade_type,
        side=candidate.side,
        entry=round(entry, decimals),
        sl=round(sl, decimals),
        tp=round(tp, decimals),
        rr=round(rr, 2),
        confidence=confidence_score,
        timeframes=candidate.timeframes,
        reasons=candidate.reasons,
        assetClass=eff_asset_class,
        exchange=eff_exchange,
        status="OPEN",
    )
