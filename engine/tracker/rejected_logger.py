"""Rejected Signal Logger & Counterfactual Simulation for SignalDesk (Phase 1).

Stores every setup candidate rejected by the ML filter with:
- Extracted feature vector
- ML probability estimate vs threshold
- Rejection rationale
- Simulated counterfactual outcome (tracking what would have happened if trade was taken)
"""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid
import pandas as pd

from engine.backtest.costs import cost_model
from engine.backtest.engine import _is_past_square_off_time

logger = logging.getLogger("signaldesk.rejected_signals")
CACHE_FILE = Path(__file__).resolve().parent.parent / "data" / "cache" / "rejected_signals.jsonl"


@dataclass
class RejectedSignalRecord:
    id: str
    symbol: str
    asset_class: str
    exchange: str
    mode: str
    side: str
    entry_price: float
    sl: float
    tp: float
    rr: float
    features: Dict[str, float]
    ml_probability: float
    ml_threshold: float
    ml_model_used: str
    rejection_reason: str
    evaluated_at: str
    counterfactual_status: str = "PENDING"
    counterfactual_exit_price: Optional[float] = None
    counterfactual_gross_r: Optional[float] = None
    counterfactual_net_r: Optional[float] = None
    counterfactual_exit_reason: Optional[str] = None
    counterfactual_resolved_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class RejectedSignalTracker:
    """Manages rejected candidate storage and forward counterfactual outcome simulation."""

    def __init__(self, cache_file: Optional[Path] = None):
        self.cache_file = cache_file or CACHE_FILE
        self._in_memory: List[RejectedSignalRecord] = []
        self._load_cache()

    def _load_cache(self) -> None:
        if not self.cache_file.exists():
            return
        try:
            with open(self.cache_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        d = json.loads(line.strip())
                        self._in_memory.append(RejectedSignalRecord(**d))
        except Exception as exc:
            logger.debug(f"Could not load rejected signals cache: {exc}")

    def log_rejected_candidate(
        self,
        symbol: str,
        side: str,
        entry_price: float,
        sl: float,
        tp: float,
        rr: float,
        features: Dict[str, float],
        ml_prob: float,
        ml_threshold: float,
        ml_model_used: str,
        rejection_reason: str,
        asset_class: str = "equity",
        exchange: str = "NSE",
        mode: str = "INTRADAY",
        evaluated_at: Optional[datetime] = None,
    ) -> RejectedSignalRecord:
        """Records a setup candidate rejected by the ML gate."""
        now_dt = evaluated_at or datetime.now(timezone.utc)
        record = RejectedSignalRecord(
            id=f"rej_{uuid.uuid4().hex[:10]}",
            symbol=symbol,
            asset_class=asset_class,
            exchange=exchange,
            mode=mode,
            side=side,
            entry_price=round(entry_price, 2),
            sl=round(sl, 2),
            tp=round(tp, 2),
            rr=round(rr, 2),
            features=features,
            ml_probability=round(ml_prob, 4),
            ml_threshold=round(ml_threshold, 4),
            ml_model_used=ml_model_used,
            rejection_reason=rejection_reason,
            evaluated_at=now_dt.isoformat(),
        )

        self._in_memory.append(record)
        self._persist_record(record)

        # Mirror to Firestore if Firebase Admin SDK is initialized
        try:
            import firebase_admin
            if firebase_admin._apps:
                from engine.data import firebase_client
                db = firebase_client.get_firestore_client()
                db.collection("rejected_signals").document(record.id).set(record.to_dict())
        except Exception:
            pass

        logger.info(
            f"Logged rejected setup for {symbol} ({side}) | ML Prob {ml_prob:.2f} < {ml_threshold:.2f} ({rejection_reason})"
        )
        return record

    def simulate_counterfactual_outcome(
        self,
        record: RejectedSignalRecord,
        future_candles: pd.DataFrame,
    ) -> RejectedSignalRecord:
        """Simulates what would have happened if this rejected setup was actually traded."""
        if future_candles.empty or record.counterfactual_status != "PENDING":
            return record

        side = record.side.upper()
        sl = record.sl
        tp = record.tp
        entry_p = record.entry_price

        for _, bar in future_candles.iterrows():
            c_high = float(bar["high"])
            c_low = float(bar["low"])
            c_close = float(bar["close"])
            bar_time = bar["time"]

            # Check 15:15 IST Intraday Square-off
            if record.asset_class == "equity" and record.mode == "INTRADAY" and _is_past_square_off_time(bar_time):
                cost_res = cost_model.calculate_costs(
                    entry_price=entry_p,
                    exit_price=c_close,
                    quantity=100,
                    side=side,
                    sl=sl,
                    asset_class=record.asset_class,
                )
                record.counterfactual_status = "SQUARE_OFF_315"
                record.counterfactual_exit_price = round(c_close, 2)
                record.counterfactual_exit_reason = "INTRADAY_SQUARE_OFF_315"
                record.counterfactual_gross_r = cost_res.gross_r
                record.counterfactual_net_r = cost_res.net_r
                record.counterfactual_resolved_at = str(bar_time)
                break

            # Check TP / SL with SL-first rule
            if side == "BUY":
                hit_sl = c_low <= sl
                hit_tp = c_high >= tp
                if hit_sl:
                    cost_res = cost_model.calculate_costs(
                        entry_price=entry_p, exit_price=sl, quantity=100, side=side, sl=sl, asset_class=record.asset_class
                    )
                    record.counterfactual_status = "SL HIT"
                    record.counterfactual_exit_price = round(sl, 2)
                    record.counterfactual_exit_reason = "STOP_LOSS_HIT"
                    record.counterfactual_gross_r = cost_res.gross_r
                    record.counterfactual_net_r = cost_res.net_r
                    record.counterfactual_resolved_at = str(bar_time)
                    break
                elif hit_tp:
                    cost_res = cost_model.calculate_costs(
                        entry_price=entry_p, exit_price=tp, quantity=100, side=side, sl=sl, asset_class=record.asset_class
                    )
                    record.counterfactual_status = "TP HIT"
                    record.counterfactual_exit_price = round(tp, 2)
                    record.counterfactual_exit_reason = "TARGET_REACHED"
                    record.counterfactual_gross_r = cost_res.gross_r
                    record.counterfactual_net_r = cost_res.net_r
                    record.counterfactual_resolved_at = str(bar_time)
                    break
            else:  # SELL
                hit_sl = c_high >= sl
                hit_tp = c_low <= tp
                if hit_sl:
                    cost_res = cost_model.calculate_costs(
                        entry_price=entry_p, exit_price=sl, quantity=100, side=side, sl=sl, asset_class=record.asset_class
                    )
                    record.counterfactual_status = "SL HIT"
                    record.counterfactual_exit_price = round(sl, 2)
                    record.counterfactual_exit_reason = "STOP_LOSS_HIT"
                    record.counterfactual_gross_r = cost_res.gross_r
                    record.counterfactual_net_r = cost_res.net_r
                    record.counterfactual_resolved_at = str(bar_time)
                    break
                elif hit_tp:
                    cost_res = cost_model.calculate_costs(
                        entry_price=entry_p, exit_price=tp, quantity=100, side=side, sl=sl, asset_class=record.asset_class
                    )
                    record.counterfactual_status = "TP HIT"
                    record.counterfactual_exit_price = round(tp, 2)
                    record.counterfactual_exit_reason = "TARGET_REACHED"
                    record.counterfactual_gross_r = cost_res.gross_r
                    record.counterfactual_net_r = cost_res.net_r
                    record.counterfactual_resolved_at = str(bar_time)
                    break

        self._persist_all()
        return record

    def _persist_record(self, record: RejectedSignalRecord) -> None:
        try:
            self.cache_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.cache_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(record.to_dict()) + "\n")
        except Exception as exc:
            logger.debug(f"Could not persist rejected signal: {exc}")

    def _persist_all(self) -> None:
        try:
            self.cache_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.cache_file, "w", encoding="utf-8") as f:
                for r in self._in_memory:
                    f.write(json.dumps(r.to_dict()) + "\n")
        except Exception:
            pass

    def get_recent_rejected(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Returns the most recent rejected signals."""
        return [r.to_dict() for r in reversed(self._in_memory[-limit:])]


rejected_tracker = RejectedSignalTracker()
