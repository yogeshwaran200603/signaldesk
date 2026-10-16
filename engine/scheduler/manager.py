"""APScheduler Manager for SignalDesk.

Schedules:
- Equity INTRADAY scan: Every 5 minutes, Mon-Fri 09:15 - 15:30 IST
- Equity DELIVERY scan: Daily at 15:45 IST (Mon-Fri)
- Crypto SCALP scan: Every 5 minutes, 24/7
- Crypto INTRADAY scan: Every 15 minutes, 24/7
- Crypto SWING scan: Every 4 hours, 24/7
- Live Tracker & Live Prices: Every 1 minute, 24/7 (equities gated by NSE hours, crypto 24/7)
"""

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

from engine.scheduler.scanner import MarketScanner
from engine.tracker.live_tracker import SignalTracker

logger = logging.getLogger("signaldesk.scheduler")
IST = pytz.timezone("Asia/Kolkata")


class ScheduleManager:
    """Manages background scheduled jobs for market scanning and position tracking."""

    def __init__(self):
        self.scheduler = BackgroundScheduler(timezone=IST)
        self.scanner = MarketScanner()
        self.tracker = SignalTracker()
        self.is_running = False

    def start(self) -> None:
        """Configures cron triggers and starts background scheduler."""
        if self.is_running:
            return

        logger.info("Initializing SignalDesk multi-asset market scheduler jobs...")

        # 1. EQUITY INTRADAY SCAN: Every 5 minutes from 09:15 to 15:30 IST, Mon-Fri
        self.scheduler.add_job(
            func=self._run_intraday_scan,
            trigger=CronTrigger(
                day_of_week="mon-fri",
                hour="9-15",
                minute="*/5",
                timezone=IST,
            ),
            id="intraday_scanner",
            name="Equity Intraday 5M Confluence Scan",
            replace_existing=True,
        )

        # 2. EQUITY DELIVERY SCAN: Mon-Fri at 15:45 IST (Post market close)
        self.scheduler.add_job(
            func=self._run_delivery_scan,
            trigger=CronTrigger(
                day_of_week="mon-fri",
                hour=15,
                minute=45,
                timezone=IST,
            ),
            id="delivery_scanner",
            name="Equity Delivery Daily Confluence Scan",
            replace_existing=True,
        )

        # 3. CRYPTO SCALP SCAN: Every 5 minutes, 24/7
        self.scheduler.add_job(
            func=self._run_crypto_scalp_scan,
            trigger=CronTrigger(minute="*/5", timezone=IST),
            id="crypto_scalp_scanner",
            name="Crypto 24/7 Scalp 5M Scan",
            replace_existing=True,
        )

        # 4. CRYPTO INTRADAY SCAN: Every 15 minutes, 24/7
        self.scheduler.add_job(
            func=self._run_crypto_intraday_scan,
            trigger=CronTrigger(minute="*/15", timezone=IST),
            id="crypto_intraday_scanner",
            name="Crypto 24/7 Intraday 15M Scan",
            replace_existing=True,
        )

        # 5. CRYPTO SWING SCAN: Every 4 hours, 24/7
        self.scheduler.add_job(
            func=self._run_crypto_swing_scan,
            trigger=CronTrigger(hour="*/4", minute=5, timezone=IST),
            id="crypto_swing_scanner",
            name="Crypto 24/7 Swing 4H Scan",
            replace_existing=True,
        )

        # 6. LIVE SIGNAL TRACKER: Every 1 minute, 24/7
        self.scheduler.add_job(
            func=self._run_tracker_cycle,
            trigger=CronTrigger(minute="*", timezone=IST),
            id="live_tracker",
            name="Multi-Asset Live TP / SL Position Tracker",
            replace_existing=True,
        )

        # 7. ENGINE HEARTBEAT: Every 1 minute, 24/7
        self.scheduler.add_job(
            func=self._write_heartbeat,
            trigger=CronTrigger(minute="*", timezone=IST),
            id="engine_heartbeat",
            name="Engine Health Heartbeat",
            replace_existing=True,
        )

        # 8. LIVE PRICES: Every 1 minute, 24/7 (equities gated by NSE hours inside scanner, crypto 24/7)
        self.scheduler.add_job(
            func=self._update_live_prices,
            trigger=CronTrigger(minute="*", timezone=IST),
            id="live_prices",
            name="Watchlist Live Prices Updater",
            replace_existing=True,
        )

        self.scheduler.start()
        self.is_running = True
        logger.info("SignalDesk Scheduler started successfully (Equities + 24/7 Crypto).")

        # Run initial heartbeat immediately
        self._write_heartbeat()

    def stop(self) -> None:
        """Shuts down scheduler gracefully."""
        if self.is_running:
            self.scheduler.shutdown(wait=False)
            self.is_running = False
            logger.info("SignalDesk Scheduler stopped.")

    def _write_heartbeat(self) -> None:
        try:
            from engine.data.config import settings
            from engine.data import firebase_client
            mode = "PAPER" if settings.paper_mode else "LIVE"
            is_open = self.scanner.is_nse_market_open()
            firebase_client.write_engine_heartbeat(mode=mode, version="1.0.0", is_market_open=is_open)
        except Exception as exc:
            logger.debug(f"[HEARTBEAT] Notice: {exc}")

    def _update_live_prices(self) -> None:
        try:
            self.scanner.update_live_prices(force_run=False)
        except Exception as exc:
            logger.debug(f"[PRICES] Notice: {exc}")

    def _run_intraday_scan(self) -> None:
        try:
            logger.info("[CRON] Triggering scheduled Equity Intraday scan...")
            self.scanner.scan_all_symbols(force_run=False, scan_type="INTRADAY", asset_class_filter="equity")
        except Exception as exc:
            logger.error(f"[CRON] Error in Equity Intraday scan: {exc}")

    def _run_delivery_scan(self) -> None:
        try:
            logger.info("[CRON] Triggering scheduled Equity Delivery scan...")
            self.scanner.scan_all_symbols(force_run=True, scan_type="DELIVERY", asset_class_filter="equity")
        except Exception as exc:
            logger.error(f"[CRON] Error in Equity Delivery scan: {exc}")

    def _run_crypto_scalp_scan(self) -> None:
        try:
            logger.info("[CRON] Triggering scheduled Crypto Scalp scan...")
            self.scanner.scan_all_symbols(force_run=True, scan_type="SCALP", asset_class_filter="crypto")
        except Exception as exc:
            logger.error(f"[CRON] Error in Crypto Scalp scan: {exc}")

    def _run_crypto_intraday_scan(self) -> None:
        try:
            logger.info("[CRON] Triggering scheduled Crypto Intraday scan...")
            self.scanner.scan_all_symbols(force_run=True, scan_type="INTRADAY", asset_class_filter="crypto")
        except Exception as exc:
            logger.error(f"[CRON] Error in Crypto Intraday scan: {exc}")

    def _run_crypto_swing_scan(self) -> None:
        try:
            logger.info("[CRON] Triggering scheduled Crypto Swing scan...")
            self.scanner.scan_all_symbols(force_run=True, scan_type="SWING", asset_class_filter="crypto")
        except Exception as exc:
            logger.error(f"[CRON] Error in Crypto Swing scan: {exc}")

    def _run_tracker_cycle(self) -> None:
        try:
            self.tracker.run_tracking_cycle()
        except Exception as exc:
            logger.error(f"[CRON] Error in live tracker: {exc}")


scheduler_manager = ScheduleManager()


