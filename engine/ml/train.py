"""Model Training and Retraining Script for SignalDesk ML Filter (Phase 4 Upgrade).

Extracts feature datasets from backtest trade logs (Supabase or local CSVs),
trains XGBoost classifiers with walk-forward chronological cross-validation
(both global and per asset_class / strategy mode), reports Precision, Recall,
ROC-AUC, Brier Score (Calibration), and Profit Factor vs the rule-only baseline,
and deploys ONLY models that beat the rule-only baseline out-of-sample.
"""

import argparse
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional, Tuple

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import numpy as np
import pandas as pd

from engine.data.config import settings
from engine.ml.features import FEATURE_NAMES
from engine.ml.model import (
    MODEL_PATH,
    ModelMetrics,
    SignalMLFilter,
    get_model_path,
    get_model_registry_name,
)


def load_labeled_trades_with_metadata(reports_dir: Path) -> pd.DataFrame:
    """Loads labeled trades with features + asset_class + trade_type from Supabase or CSV reports."""
    records: List[Dict[str, Any]] = []

    # 1. Try reading from Supabase backtest_trades table
    try:
        from engine.db.supabase_client import get_supabase_client, is_supabase_configured

        if is_supabase_configured():
            client = get_supabase_client()
            res = client.table("backtest_trades").select(
                "symbol, asset_class, trade_type, entry, sl, tp, rr, opened_at, features, outcome, pnl_r"
            ).execute()
            if res.data:
                for r in res.data:
                    outcome = str(r.get("outcome", "")).strip()
                    if outcome not in ("TP HIT", "SL HIT"):
                        continue
                    feats = r.get("features") or {}
                    sym = str(r.get("symbol", ""))
                    ac = str(r.get("asset_class") or ("crypto" if "/" in sym else "equity")).lower()
                    t_type = str(r.get("trade_type") or "INTRADAY").upper()
                    pnl_r = float(r.get("pnl_r") or (2.0 if outcome == "TP HIT" else -1.0))

                    if isinstance(feats, dict) and all(k in feats for k in FEATURE_NAMES):
                        row_dict = {k: float(feats[k]) for k in FEATURE_NAMES}
                    else:
                        entry_p = float(r.get("entry") or 100.0)
                        sl_p = float(r.get("sl") or 95.0)
                        tp_p = float(r.get("tp") or 110.0)
                        rr = float(r.get("rr") or 2.0)
                        conf = float(feats.get("confidence", 75.0) if isinstance(feats, dict) else 75.0)
                        atr_proxy = max(0.0001, abs(entry_p - sl_p) / 1.5)
                        dist_tp = abs(tp_p - entry_p)
                        row_dict = {
                            "htf_alignment": 1.0,
                            "volume_ratio": round(1.2 + (conf / 100.0) * 0.8, 3),
                            "zone_size_atr": round(abs(entry_p - sl_p) / atr_proxy, 3),
                            "distance_to_target_atr": round(dist_tp / atr_proxy, 3),
                            "atr_pct": round((atr_proxy / max(entry_p, 0.0001)) * 100.0, 3),
                            "time_of_day_minute": 90.0,
                            "day_of_week": 2.0,
                            "trend_strength": round((rr - 2.0) * 0.5, 3),
                            "confluence_count": float(min(7, max(3, int(conf / 15)))),
                            "rr_planned": round(rr, 2),
                        }
                    row_dict["asset_class"] = ac
                    row_dict["mode"] = "SCALP" if t_type in ("SCALP", "SCALPING") else ("SWING" if t_type in ("SWING", "DELIVERY") else "INTRADAY")
                    row_dict["target"] = 1 if (outcome == "TP HIT" and pnl_r > 0) else 0
                    records.append(row_dict)
    except Exception as exc:
        print(f"[DEBUG] Fallback to CSV reports due to: {exc}")

    # 2. Load from local CSV trade reports
    csv_files = sorted(reports_dir.glob("trades_*.csv"))
    for csv_file in csv_files:
        try:
            df = pd.read_csv(csv_file)
            if df.empty or "status" not in df.columns:
                continue

            for _, row in df.iterrows():
                status = str(row["status"]).strip()
                if status not in ("TP HIT", "SL HIT"):
                    continue

                sym = str(row.get("symbol", csv_file.stem))
                ac = str(row.get("asset_class") or ("crypto" if ("/" in sym or "USDT" in sym) else "equity")).lower()
                t_type = str(row.get("trade_type", "INTRADAY")).upper()
                entry_p = float(row.get("entry_price", 100.0))
                sl_p = float(row.get("sl", 95.0))
                tp_p = float(row.get("tp", 110.0))
                rr = float(row.get("rr_planned", 2.0))
                conf = float(row.get("confidence", 70.0))
                pnl = float(row.get("pnl", 1.0 if status == "TP HIT" else -1.0))
                entry_time_str = str(row.get("entry_time", ""))

                atr_proxy = max(0.0001, abs(entry_p - sl_p) / 1.5)
                dist_tp = abs(tp_p - entry_p)

                try:
                    t_dt = pd.to_datetime(entry_time_str)
                    minutes_from_open = max(0.0, float((t_dt.hour * 60 + t_dt.minute) - (0 if ac == "crypto" else 555)))
                    dow = float(t_dt.weekday())
                except Exception:
                    minutes_from_open = 90.0
                    dow = 2.0

                records.append(
                    {
                        "htf_alignment": 1.0,
                        "volume_ratio": round(1.2 + (conf / 100.0) * 0.8, 3),
                        "zone_size_atr": round(abs(entry_p - sl_p) / atr_proxy, 3),
                        "distance_to_target_atr": round(dist_tp / atr_proxy, 3),
                        "atr_pct": round((atr_proxy / max(entry_p, 0.0001)) * 100.0, 3),
                        "time_of_day_minute": minutes_from_open,
                        "day_of_week": dow,
                        "trend_strength": round((rr - 2.0) * 0.5, 3),
                        "confluence_count": float(min(7, max(3, int(conf / 15)))),
                        "rr_planned": round(rr, 2),
                        "asset_class": ac,
                        "mode": "SCALP" if t_type in ("SCALP", "SCALPING") else ("SWING" if t_type in ("SWING", "DELIVERY") else "INTRADAY"),
                        "target": 1 if (status == "TP HIT" and pnl > 0) else 0,
                    }
                )
        except Exception as exc:
            print(f"[WARN] Error reading {csv_file}: {exc}")

    return pd.DataFrame(records)


def load_dataset_from_trade_reports(reports_dir: Path) -> Tuple[pd.DataFrame, pd.Series]:
    """Compatibility helper returning (X, y) for all loaded trades."""
    full_df = load_labeled_trades_with_metadata(reports_dir)
    if full_df.empty:
        return pd.DataFrame(columns=FEATURE_NAMES), pd.Series(dtype=int)
    return full_df[FEATURE_NAMES].copy(), full_df["target"].astype(int)


def train_and_evaluate_segment(
    df_seg: pd.DataFrame,
    asset_class: str,
    mode: str,
    threshold: float,
) -> Optional[ModelMetrics]:
    """Trains walk-forward XGBoost model for a specific segment and deploys ONLY if it beats baseline."""
    if len(df_seg) < 15 or len(df_seg["target"].unique()) < 2:
        return None

    X = df_seg[FEATURE_NAMES].reset_index(drop=True)
    y = df_seg["target"].astype(int).reset_index(drop=True)

    ml_filter = SignalMLFilter(asset_class=asset_class, mode=mode)
    ml_filter.threshold = threshold
    metrics, importances = ml_filter.fit_walk_forward(
        X, y, n_splits=3, asset_class=asset_class, mode=mode
    )

    target_path = (
        MODEL_PATH
        if (asset_class == "all" and mode == "all")
        else get_model_path(asset_class, mode)
    )
    reg_name = (
        "confluence_filter"
        if (asset_class == "all" and mode == "all")
        else get_model_registry_name(asset_class, mode)
    )

    if metrics.beats_baseline:
        saved_path = ml_filter.save(target_path)
        try:
            from engine.db.supabase_client import save_ml_model_record

            model_id = f"xgb_{asset_class}_{mode}_{int(datetime.now().timestamp())}"
            save_ml_model_record(
                model_id=model_id,
                name=reg_name,
                version="2.0.0",
                metrics=asdict(metrics),
                path=str(saved_path),
                active=True,
            )
        except Exception:
            pass
    else:
        print(
            f"  [GATE] Segment ({asset_class}/{mode}) did NOT beat rule-only baseline OOS "
            f"(Filtered PF {metrics.filtered_profit_factor:.2f} vs Baseline PF {metrics.rule_baseline_profit_factor:.2f}). "
            f"Keeping rule-only baseline."
        )

    return metrics


def main():
    parser = argparse.ArgumentParser(description="Train SignalDesk Walk-Forward ML Filter Models")
    parser.add_argument(
        "--reports-dir",
        type=str,
        default="engine/backtest/reports",
        help="Path to backtest reports folder containing trades_*.csv",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=settings.ml_threshold,
        help="Win probability threshold (default: from config)",
    )

    args = parser.parse_args()
    reports_path = Path(args.reports_dir)

    print("=" * 72)
    print("      SIGNALDESK WALK-FORWARD XGBOOST ML TRAINING PIPELINE (PHASE 4)   ")
    print("=" * 72)
    print(f"Loading backtested trade datasets from Supabase & {reports_path}...")

    full_df = load_labeled_trades_with_metadata(reports_path)
    print(f"Total labeled trade setups extracted: {len(full_df)}")

    if len(full_df) < 15:
        print("[ERROR] Insufficient trade data (< 15 trades). Please run historical backtests first.")
        sys.exit(1)

    all_metrics: List[ModelMetrics] = []

    # 1. Train Global Multi-Asset Model
    global_m = train_and_evaluate_segment(full_df, "all", "all", args.threshold)
    if global_m:
        all_metrics.append(global_m)

    # 2. Train Per-Asset-Class & Per-Mode Models where sample size >= 15
    for ac in ("equity", "crypto"):
        ac_df = full_df[full_df["asset_class"] == ac]
        if len(ac_df) >= 15:
            m_ac = train_and_evaluate_segment(ac_df, ac, "all", args.threshold)
            if m_ac:
                all_metrics.append(m_ac)
        for mode in ("SCALP", "INTRADAY", "SWING"):
            seg_df = full_df[(full_df["asset_class"] == ac) & (full_df["mode"] == mode)]
            if len(seg_df) >= 15:
                m_seg = train_and_evaluate_segment(seg_df, ac, mode.lower(), args.threshold)
                if m_seg:
                    all_metrics.append(m_seg)

    # Save training summary for /api/ml/status
    try:
        import joblib
        from engine.ml.model import MODEL_DIR

        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        summary_dict = {
            f"{m.asset_class}/{m.mode}": asdict(m)
            for m in all_metrics
        }
        joblib.dump(summary_dict, MODEL_DIR / "training_summary.joblib")
    except Exception as exc:
        print(f"[WARN] Could not save training_summary.joblib: {exc}")

    print("\n" + "=" * 108)
    print(
        f"{'Segment':<18} | {'Samples':<7} | {'Base WR':<8} | {'ML WR':<8} | {'Prec':<7} | {'Recall':<7} | "
        f"{'Base PF':<7} | {'ML PF':<7} | {'AUC':<6} | {'Brier':<6} | {'Gate'}"
    )
    print("-" * 108)
    for m in all_metrics:
        seg_label = f"{m.asset_class}/{m.mode}"
        gate_str = "DEPLOYED" if m.beats_baseline else "RULE-ONLY"
        print(
            f"{seg_label:<18} | {m.total_samples:<7} | {m.rule_baseline_winrate:>6.2f}% | "
            f"{m.filtered_winrate:>6.2f}% | {m.precision:>5.1f}% | {m.recall:>5.1f}% | "
            f"{m.rule_baseline_profit_factor:>7.2f} | "
            f"{m.filtered_profit_factor:>7.2f} | {m.roc_auc:>6.3f} | {m.brier_score:>6.3f} | {gate_str}"
        )
    print("=" * 108)


if __name__ == "__main__":
    main()

