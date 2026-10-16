"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import type {
  CandleBar,
  ChartOverlays,
  ConfirmedSignalOverlay,
  OverlayToggles,
} from "@/components/live/LiveCandleChart";
import type { SymbolSearchResult } from "@/components/live/CommandPaletteModal";
import { LiveTopBar, StrategyModeType } from "@/components/live/LiveTopBar";
import { LiveLeftRail } from "@/components/live/LiveLeftRail";
import { LiveChartToolbar } from "@/components/live/LiveChartToolbar";
import { LiveRightPanel } from "@/components/live/LiveRightPanel";
import { LiveMobileNav } from "@/components/live/LiveMobileNav";
import { 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  AlertTriangle,
  X
} from "lucide-react";

const LiveCandleChart = dynamic(() => import("@/components/live/LiveCandleChart"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] bg-bg-base flex items-center justify-center text-xs font-mono text-slate-500 animate-pulse">
      Loading OctaTrader Chart Engine...
    </div>
  ),
});

const CommandPaletteModal = dynamic(
  () => import("@/components/live/CommandPaletteModal"),
  { ssr: false }
);

const BACKEND_API_BASE =
  process.env.NEXT_PUBLIC_ENGINE_URL?.replace(/\/$/, "") || "http://localhost:8000";

type AssetClassType = "equity" | "crypto" | "forex";
type LifecycleStateType =
  | "WATCHING"
  | "FORMING"
  | "CONFIRMED"
  | "ACTIVE"
  | "TP HIT"
  | "SL HIT"
  | "INVALIDATED"
  | "EXPIRED";

interface ChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  required: boolean;
  status: "PASSED" | "PENDING" | "FAILED";
  detail: string;
}

interface ConfirmedSignalData extends ConfirmedSignalOverlay {
  symbol: string;
  assetClass: string;
  exchange: string;
  mode: string;
  tradeType: string;
  confidence: number;
  mlProbability: number;
  mlModelUsed: string;
  confirmedAt: string;
  reasons: string[];
  timeframes: { entry: string; bias: string };
  closedAt?: string | null;
  exitPrice?: number | null;
  outcome?: string | null;
}

interface FeedStatusState {
  status: "LIVE" | "DELAYED" | "CLOSED" | "UNAVAILABLE";
  delaySeconds: number;
  lastTickAt: string | null;
  reason: string | null;
  error?: string | null;
}

interface EvaluationData {
  symbol: string;
  assetClass: string;
  exchange: string;
  mode: StrategyModeType;
  entryTimeframe: string;
  biasTimeframe: string;
  htfBias: "BULLISH" | "BEARISH" | "NEUTRAL";
  state: LifecycleStateType;
  statusMessage: string;
  passedCount: number;
  totalCount: number;
  mlProbability: number | null;
  mlThreshold: number;
  checklist: ChecklistItem[];
  signal: ConfirmedSignalData | null;
  overlays: ChartOverlays;
  evaluatedAt: string;
  decidedOnCandleClose: boolean;
}

const DEFAULT_OVERLAY_TOGGLES: OverlayToggles = {
  orderBlocks: true,
  fvgs: true,
  liquidity: true,
  vwap: true,
  tradeLevels: true,
};

const MODE_DEFAULT_TIMEFRAME: Record<AssetClassType, Record<StrategyModeType, string>> = {
  equity: { SCALPING: "1m", INTRADAY: "5m", SWING: "1d" },
  crypto: { SCALPING: "5m", INTRADAY: "15m", SWING: "4h" },
  forex: { SCALPING: "5m", INTRADAY: "15m", SWING: "4h" },
};

const POPULAR_BY_ASSET: Record<AssetClassType, SymbolSearchResult[]> = {
  equity: [
    { symbol: "RELIANCE-EQ", name: "Reliance Industries", assetClass: "equity", exchange: "NSE" },
    { symbol: "TCS-EQ", name: "Tata Consultancy Services", assetClass: "equity", exchange: "NSE" },
    { symbol: "HDFCBANK-EQ", name: "HDFC Bank", assetClass: "equity", exchange: "NSE" },
    { symbol: "INFY-EQ", name: "Infosys", assetClass: "equity", exchange: "NSE" },
    { symbol: "ICICIBANK-EQ", name: "ICICI Bank", assetClass: "equity", exchange: "NSE" },
    { symbol: "SBIN-EQ", name: "State Bank of India", assetClass: "equity", exchange: "NSE" },
  ],
  crypto: [
    { symbol: "BTC/USDT", name: "Bitcoin / Tether USDT", assetClass: "crypto", exchange: "BINANCE" },
    { symbol: "ETH/USDT", name: "Ethereum / Tether USDT", assetClass: "crypto", exchange: "BINANCE" },
    { symbol: "SOL/USDT", name: "Solana / Tether USDT", assetClass: "crypto", exchange: "BINANCE" },
  ],
  forex: [
    { symbol: "EUR/USD", name: "Euro / US Dollar", assetClass: "forex", exchange: "FX" },
    { symbol: "GBP/USD", name: "British Pound / US Dollar", assetClass: "forex", exchange: "FX" },
    { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", assetClass: "forex", exchange: "FX" },
  ],
};

function playConfirmationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.11);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {}
}

export default function LiveAnalysisPage() {
  const { user } = useAuth();

  // Active Symbol & Mode State
  const [assetClass, setAssetClass] = useState<AssetClassType>("equity");
  const [symbol, setSymbol] = useState<string>("RELIANCE-EQ");
  const [symbolName, setSymbolName] = useState<string>("Reliance Industries");
  const [exchange, setExchange] = useState<string>("NSE");
  const [mode, setMode] = useState<StrategyModeType>("INTRADAY");
  const [interval, setIntervalState] = useState<string>("5m");
  const [chartType, setChartType] = useState<"candles" | "line">("candles");
  const [overlayToggles, setOverlayToggles] = useState<OverlayToggles>(DEFAULT_OVERLAY_TOGGLES);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  // Layout states (OctaTrader)
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState<boolean>(false);
  const [isChartExpanded, setIsChartExpanded] = useState<boolean>(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState<boolean>(false);
  const [isLayoutSaved, setIsLayoutSaved] = useState<boolean>(false);

  // Chart data & telemetry state
  const [candles, setCandles] = useState<CandleBar[]>([]);
  const [latestFormingCandle, setLatestFormingCandle] = useState<CandleBar | null>(null);
  const [ltp, setLtp] = useState<number>(0);
  const [changePct, setChangePct] = useState<number>(0);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const [feedStatus, setFeedStatus] = useState<FeedStatusState>({
    status: "DELAYED",
    delaySeconds: 0,
    lastTickAt: null,
    reason: null,
  });
  const [feedError, setFeedError] = useState<string | null>(null);
  const [loadingChart, setLoadingChart] = useState<boolean>(true);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [wsDisconnectedBanner, setWsDisconnectedBanner] = useState<boolean>(false);

  // Evaluation & Strategy state
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [recentSignals, setRecentSignals] = useState<ConfirmedSignalData[]>([]);
  const [watchlist, setWatchlist] = useState<SymbolSearchResult[]>([]);
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Array<{ id: string; type: "success" | "error" | "info"; message: string }>>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLtpRef = useRef<number>(0);
  const lastAlertedSignalIdRef = useRef<string | null>(null);
  const prefsHydratedRef = useRef<boolean>(false);
  const queryParamAppliedRef = useRef<boolean>(false);

  const addToast = useCallback((type: "success" | "error" | "info", message: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  // Read URL query params (?symbol=TCS-EQ&assetClass=equity&exchange=NSE)
  useEffect(() => {
    if (queryParamAppliedRef.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const qSym = params.get("symbol");
    const qAc = params.get("assetClass") as AssetClassType | null;
    const qEx = params.get("exchange");
    if (qSym) {
      queryParamAppliedRef.current = true;
      const resolvedAc: AssetClassType =
        qAc && ["equity", "crypto", "forex"].includes(qAc)
          ? qAc
          : qSym.includes("/")
          ? "crypto"
          : "equity";
      const resolvedSym =
        resolvedAc === "equity" && !qSym.toUpperCase().endsWith("-EQ") && !qSym.includes("/")
          ? `${qSym.toUpperCase()}-EQ`
          : qSym.toUpperCase();
      const resolvedEx =
        qEx || (resolvedAc === "crypto" ? "BINANCE" : resolvedAc === "forex" ? "FX" : "NSE");
      setAssetClass(resolvedAc);
      setSymbol(resolvedSym);
      setSymbolName(resolvedSym.replace(/-EQ$/i, ""));
      setExchange(resolvedEx);
      setIntervalState(MODE_DEFAULT_TIMEFRAME[resolvedAc][mode]);
    }
  }, [mode]);

  // Firestore user preferences sync
  useEffect(() => {
    if (!user) return;
    let unsubUser: (() => void) | null = null;
    let active = true;

    import("@/lib/firestore")
      .then(({ db, doc, onSnapshot }) => {
        if (!active) return;
        unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
          if (!prefsHydratedRef.current && !queryParamAppliedRef.current && snap.exists()) {
            const prefs = snap.data()?.livePrefs;
            if (prefs) {
              if (prefs.assetClass) setAssetClass(prefs.assetClass);
              if (prefs.symbol) {
                setSymbol(prefs.symbol);
                setSymbolName(String(prefs.symbol).replace(/-EQ$/i, ""));
              }
              if (prefs.exchange) setExchange(prefs.exchange);
              if (prefs.mode) setMode(prefs.mode);
              if (prefs.interval) setIntervalState(prefs.interval);
              if (prefs.overlayToggles) {
                setOverlayToggles({ ...DEFAULT_OVERLAY_TOGGLES, ...prefs.overlayToggles });
              }
              if (typeof prefs.isRightPanelCollapsed === "boolean") {
                setIsRightPanelCollapsed(prefs.isRightPanelCollapsed);
              }
            }
          }
          prefsHydratedRef.current = true;
        });
      })
      .catch(() => {});

    return () => {
      active = false;
      if (unsubUser) unsubUser();
    };
  }, [user]);

  const saveLivePrefs = useCallback(
    async (next: {
      assetClass?: AssetClassType;
      symbol?: string;
      exchange?: string;
      mode?: StrategyModeType;
      interval?: string;
      overlayToggles?: OverlayToggles;
      isRightPanelCollapsed?: boolean;
    }) => {
      // Save to localStorage immediately
      try {
        localStorage.setItem("sd_live_prefs", JSON.stringify(next));
        setIsLayoutSaved(true);
        setTimeout(() => setIsLayoutSaved(false), 2000);
      } catch {}

      if (!user) return;
      try {
        const { db, doc, setDoc, serverTimestamp } = await import("@/lib/firestore");
        const merged = {
          assetClass: next.assetClass ?? assetClass,
          symbol: next.symbol ?? symbol,
          exchange: next.exchange ?? exchange,
          mode: next.mode ?? mode,
          interval: next.interval ?? interval,
          overlayToggles: next.overlayToggles ?? overlayToggles,
          isRightPanelCollapsed: next.isRightPanelCollapsed ?? isRightPanelCollapsed,
          updatedAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", user.uid), { livePrefs: merged }, { merge: true });
      } catch {}
    },
    [user, assetClass, symbol, exchange, mode, interval, overlayToggles, isRightPanelCollapsed]
  );

  // Apply snapshot payload from REST or WebSocket
  const applySnapshot = useCallback(
    (data: any, isChartOnlySnapshot = false) => {
      const incomingCandles: CandleBar[] = Array.isArray(data?.candles) ? data.candles : [];
      if (incomingCandles.length > 0 || isChartOnlySnapshot) {
        setCandles(incomingCandles);
        setLatestFormingCandle(null);
      }

      const nextLtp =
        typeof data?.ltp === "number" && data.ltp > 0
          ? data.ltp
          : incomingCandles.length > 0
          ? Number(incomingCandles[incomingCandles.length - 1].close)
          : 0;
      if (nextLtp > 0) {
        setLtp(nextLtp);
        prevLtpRef.current = nextLtp;
      }

      if (typeof data?.changePct === "number") {
        setChangePct(data.changePct);
      }

      const fs: FeedStatusState = data?.feedStatus || {
        status: "CLOSED",
        delaySeconds: 0,
        lastTickAt: null,
        reason: null,
      };
      setFeedStatus(fs);

      if (data?.evaluation) {
        setEvaluation(data.evaluation);
        const sig = data.evaluation.signal;
        if (
          sig &&
          (data.evaluation.state === "CONFIRMED" || data.evaluation.state === "ACTIVE") &&
          lastAlertedSignalIdRef.current !== sig.id
        ) {
          lastAlertedSignalIdRef.current = sig.id;
          if (soundEnabled) playConfirmationChime();
        }
      }

      if (Array.isArray(data?.recentSignals)) {
        setRecentSignals(data.recentSignals);
      }

      if (fs.error) {
        setFeedError(fs.error);
      } else if (fs.status === "UNAVAILABLE") {
        setFeedError(
          fs.reason ||
            `Data feed unavailable for ${symbol}. Verify Angel One credentials in engine/.env.`
        );
      } else if (incomingCandles.length === 0 && isChartOnlySnapshot) {
        setFeedError(
          fs.reason ||
            `No historical candle data returned for ${symbol.replace(/-EQ$/i, "")}.`
        );
      } else if (incomingCandles.length > 0) {
        setFeedError(null);
      }

      setLoadingChart(false);
      setIsTransitioning(false);
    },
    [symbol, soundEnabled]
  );

  // Load candles & establish live WebSocket
  const loadAndSubscribe = useCallback(
    async (
      targetSymbol: string,
      targetAc: AssetClassType,
      targetEx: string,
      targetMode: StrategyModeType,
      targetInterval: string
    ) => {
      setIsTransitioning(true);
      setFeedError(null);

      // Fast chart-only snapshot
      try {
        const fastParams = new URLSearchParams({
          symbol: targetSymbol,
          assetClass: targetAc,
          exchange: targetEx,
          mode: targetMode,
          interval: targetInterval,
          chartOnly: "true",
        });
        const fastRes = await fetch(
          `${BACKEND_API_BASE}/api/live/state?${fastParams.toString()}`,
          { cache: "no-store" }
        );
        if (fastRes.ok) {
          const fastData = await fastRes.json();
          applySnapshot(fastData, true);
        }
      } catch (err: any) {
        setCandles([]);
        setFeedError(
          `Cannot reach Python engine at ${BACKEND_API_BASE}. Ensure engine is running.`
        );
        setLoadingChart(false);
        setIsTransitioning(false);
        return;
      }

      // Full strategy evaluation
      try {
        const fullParams = new URLSearchParams({
          symbol: targetSymbol,
          assetClass: targetAc,
          exchange: targetEx,
          mode: targetMode,
          interval: targetInterval,
          chartOnly: "false",
        });
        const fullRes = await fetch(
          `${BACKEND_API_BASE}/api/live/state?${fullParams.toString()}`,
          { cache: "no-store" }
        );
        if (fullRes.ok) {
          const fullData = await fullRes.json();
          applySnapshot(fullData, false);
        }
      } catch {}

      // WebSocket connection
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            action: "subscribe",
            symbol: targetSymbol,
            assetClass: targetAc,
            exchange: targetEx,
            mode: targetMode,
            interval: targetInterval,
            chartOnly: false,
          })
        );
        return;
      }

      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }

      const connectWs = async (retryAttempt = 0) => {
        try {
          let idToken = "";
          if (user) {
            try {
              idToken = await user.getIdToken();
            } catch {}
          }
          const wsBase = BACKEND_API_BASE.replace(/^http/i, "ws");
          const wsParams = new URLSearchParams({
            symbol: targetSymbol,
            assetClass: targetAc,
            exchange: targetEx,
            mode: targetMode,
            interval: targetInterval,
            chartOnly: "false",
          });
          if (idToken) wsParams.set("token", idToken);

          const ws = new WebSocket(`${wsBase}/ws/live?${wsParams.toString()}`);
          wsRef.current = ws;

          ws.onopen = () => setWsDisconnectedBanner(false);

          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === "snapshot") {
                applySnapshot(msg, false);
              } else if (msg.type === "tick") {
                if (typeof msg.ltp === "number" && msg.ltp > 0) {
                  const prev = prevLtpRef.current;
                  if (prev > 0 && msg.ltp !== prev) {
                    setPriceFlash(msg.ltp > prev ? "up" : "down");
                    window.setTimeout(() => setPriceFlash(null), 450);
                  }
                  prevLtpRef.current = msg.ltp;
                  setLtp(msg.ltp);
                }
                if (typeof msg.changePct === "number") setChangePct(msg.changePct);
                if (msg.feedStatus) setFeedStatus(msg.feedStatus);
                const tfUpdate = msg.candles?.[targetInterval];
                if (tfUpdate?.forming) setLatestFormingCandle(tfUpdate.forming);
                if (tfUpdate?.closed) {
                  setCandles((prev) => [...prev.slice(-249), tfUpdate.closed]);
                }
              } else if (msg.type === "evaluation" && msg.evaluation) {
                setEvaluation(msg.evaluation);
                if (msg.evaluation.state === "CONFIRMED" && msg.evaluation.signal) {
                  const sig = msg.evaluation.signal;
                  if (lastAlertedSignalIdRef.current !== sig.id) {
                    lastAlertedSignalIdRef.current = sig.id;
                    if (soundEnabled) playConfirmationChime();
                    addToast("success", `CONFIRMED ${sig.side} setup on ${msg.symbol} (${msg.interval})`);
                  }
                }
              }
            } catch {}
          };

          ws.onclose = () => {
            if (wsRef.current === ws) {
              setWsDisconnectedBanner(true);
              const delayMs = Math.min(12000, 1500 * Math.pow(1.6, retryAttempt));
              reconnectTimerRef.current = setTimeout(() => void connectWs(retryAttempt + 1), delayMs);
            }
          };

          ws.onerror = () => {
            try {
              ws.close();
            } catch {}
          };
        } catch {}
      };

      void connectWs(0);
    },
    [user, applySnapshot, soundEnabled, addToast]
  );

  useEffect(() => {
    void loadAndSubscribe(symbol, assetClass, exchange, mode, interval);
  }, [symbol, assetClass, exchange, mode, interval, loadAndSubscribe]);

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        try {
          const closingWs = wsRef.current;
          wsRef.current = null;
          closingWs.close();
        } catch {}
      }
    };
  }, []);

  // Keyboard Shortcuts (Ctrl+K, '/', '1','2','3', Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }
      if (!isInput && e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setMobileSheetOpen(false);
        return;
      }
      if (!isInput && !paletteOpen && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "1") handleModeChange("SCALPING");
        else if (e.key === "2") handleModeChange("INTRADAY");
        else if (e.key === "3") handleModeChange("SWING");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Action Handlers
  const handleSelectSymbol = (opt: SymbolSearchResult) => {
    const nextAc = opt.assetClass || assetClass;
    const normSym =
      nextAc === "equity" && !opt.symbol.toUpperCase().endsWith("-EQ") && !opt.symbol.includes("/")
        ? `${opt.symbol.toUpperCase()}-EQ`
        : opt.symbol.toUpperCase();
    const nextEx =
      opt.exchange || (nextAc === "crypto" ? "BINANCE" : nextAc === "forex" ? "FX" : "NSE");
    const nextTf = MODE_DEFAULT_TIMEFRAME[nextAc]?.[mode] || interval;

    setAssetClass(nextAc);
    setSymbol(normSym);
    setSymbolName(opt.name || normSym.replace(/-EQ$/i, ""));
    setExchange(nextEx);
    setIntervalState(nextTf);
    void saveLivePrefs({
      assetClass: nextAc,
      symbol: normSym,
      exchange: nextEx,
      interval: nextTf,
    });
  };

  const handleModeChange = (nextMode: StrategyModeType) => {
    const nextTf = MODE_DEFAULT_TIMEFRAME[assetClass][nextMode];
    setMode(nextMode);
    setIntervalState(nextTf);
    void saveLivePrefs({ mode: nextMode, interval: nextTf });
  };

  const handleTimeframeChange = (nextTf: string) => {
    setIntervalState(nextTf);
    void saveLivePrefs({ interval: nextTf });
  };

  const handleToggleOverlay = (key: keyof OverlayToggles) => {
    setOverlayToggles((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      void saveLivePrefs({ overlayToggles: updated });
      return updated;
    });
  };

  const handleResetLayout = () => {
    setIsRightPanelCollapsed(false);
    setIsChartExpanded(false);
    setOverlayToggles(DEFAULT_OVERLAY_TOGGLES);
    addToast("info", "Workspace layout reset to OctaTrader default.");
  };

  const handleSaveLayout = () => {
    void saveLivePrefs({
      overlayToggles,
      isRightPanelCollapsed,
      interval,
      mode,
    });
    addToast("success", "Chart indicators and terminal layout saved.");
  };

  const handleLoadSignalOnChart = (sig: any) => {
    if (!sig?.symbol) return;
    const cleanSym = String(sig.symbol).toUpperCase();
    const ac = (sig.assetClass || (cleanSym.includes("/") ? "crypto" : "equity")) as AssetClassType;
    const ex = sig.exchange || (ac === "crypto" ? "BINANCE" : ac === "forex" ? "FX" : "NSE");
    const tf = sig.timeframe || sig.interval || interval;

    handleSelectSymbol({
      symbol: cleanSym,
      name: cleanSym.replace(/-EQ$/i, ""),
      assetClass: ac,
      exchange: ex,
    });
    setIntervalState(tf);
    setMobileSheetOpen(false);
    addToast("info", `Loaded ${cleanSym} (${tf}) setup on chart.`);
  };

  const decimals =
    assetClass === "forex" ? 4 : assetClass === "crypto" && ltp > 0 && ltp < 2 ? 4 : 2;
  const pricePrefix = assetClass === "equity" ? "₹" : assetClass === "crypto" ? "$" : "";

  const timeframes =
    assetClass === "equity"
      ? [
          { id: "1m", label: "1m" },
          { id: "5m", label: "5m" },
          { id: "15m", label: "15m" },
          { id: "1h", label: "1h" },
          { id: "1d", label: "1D" },
        ]
      : [
          { id: "1m", label: "1m" },
          { id: "5m", label: "5m" },
          { id: "15m", label: "15m" },
          { id: "1h", label: "1h" },
          { id: "4h", label: "4h" },
          { id: "1d", label: "1D" },
        ];

  const quickSymbolsList = [
    { symbol: "NIFTY-EQ", name: "NIFTY 50", assetClass: "equity" as const, exchange: "NSE" },
    { symbol: "BANKNIFTY-EQ", name: "BANK NIFTY", assetClass: "equity" as const, exchange: "NSE" },
    { symbol: "RELIANCE-EQ", name: "Reliance Industries", assetClass: "equity" as const, exchange: "NSE" },
    { symbol: "BTC/USDT", name: "Bitcoin", assetClass: "crypto" as const, exchange: "BINANCE" },
    { symbol: "EUR/USD", name: "Euro / US Dollar", assetClass: "forex" as const, exchange: "FX" },
  ];

  return (
    <div className="h-screen w-screen bg-bg-base text-slate-100 flex flex-col overflow-hidden select-none">
      
      {/* Toast Notifications */}
      <div className="fixed bottom-16 md:bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-2xl flex items-center gap-2.5 text-xs font-mono backdrop-blur-md transition-all ${
              t.type === "success"
                ? "bg-bg-card/95 border-success/40 text-success"
                : t.type === "error"
                ? "bg-bg-card/95 border-danger/40 text-danger"
                : "bg-bg-card/95 border-brand-blue/40 text-brand-blue"
            }`}
          >
            {t.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-success shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-danger shrink-0" />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Command Palette Modal (Ctrl+K) */}
      {paletteOpen && (
        <CommandPaletteModal
          isOpen={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          engineUrl={BACKEND_API_BASE}
          activeAssetClass={assetClass}
          watchlist={watchlist}
          onSelectSymbol={handleSelectSymbol}
          onSelectMode={handleModeChange}
          onSelectTimeframe={handleTimeframeChange}
        />
      )}

      {/* 1. OctaTrader Top Bar */}
      <LiveTopBar
        symbol={symbol}
        symbolName={symbolName}
        exchange={exchange}
        ltp={ltp}
        changePct={changePct}
        priceFlash={priceFlash}
        feedStatus={feedStatus}
        latencyMs={18}
        mode={mode}
        onModeChange={handleModeChange}
        onOpenSearch={() => setPaletteOpen(true)}
        quickSymbols={quickSymbolsList}
        onSelectQuickSymbol={handleSelectSymbol}
        onResetLayout={handleResetLayout}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        user={user}
        decimals={decimals}
        pricePrefix={pricePrefix}
      />

      {/* Auto-reconnect banner if connection drops */}
      {wsDisconnectedBanner && (
        <div className="bg-warning/15 border-b border-warning/30 px-4 py-1.5 text-xs font-mono text-warning flex items-center justify-between">
          <span className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Live WebSocket disconnected. Reconnecting to MarketDataHub...
          </span>
          <button
            type="button"
            onClick={() => void loadAndSubscribe(symbol, assetClass, exchange, mode, interval)}
            className="text-brand-blue hover:underline font-semibold"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* 2. Main Workspace Body (Left Rail + Center Chart + Right Panel) */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left slim icon rail (48-56px) */}
        <LiveLeftRail onOpenSettings={() => setPaletteOpen(true)} />

        {/* Center: Full-height Chart Container */}
        <div className="flex-1 flex flex-col min-w-0 bg-bg-base overflow-hidden">
          
          {/* Chart Toolbar */}
          <LiveChartToolbar
            interval={interval}
            onIntervalChange={handleTimeframeChange}
            timeframes={timeframes}
            chartType={chartType}
            onChartTypeChange={setChartType}
            overlayToggles={overlayToggles}
            onToggleOverlay={handleToggleOverlay}
            isExpanded={isChartExpanded}
            onToggleExpanded={() => setIsChartExpanded((prev) => !prev)}
            onSaveLayout={handleSaveLayout}
            isSaved={isLayoutSaved}
          />

          {/* Chart Display Area */}
          <div className="flex-1 w-full h-full relative overflow-hidden bg-bg-base">
            {feedError && (
              <div className="absolute top-3 left-3 right-3 z-20 p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs font-mono text-danger flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{feedError}</span>
              </div>
            )}

            {loadingChart ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500 font-mono text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-brand-blue" />
                <span>Loading ticks and candle history for {symbol}...</span>
              </div>
            ) : (
              <LiveCandleChart
                symbol={symbol}
                assetClass={assetClass}
                interval={interval}
                candles={candles}
                latestFormingCandle={latestFormingCandle}
                isTransitioning={isTransitioning}
                overlays={
                  evaluation?.overlays || {
                    orderBlocks: [],
                    fvgs: [],
                    liquidityLevels: [],
                    vwap: [],
                    poc: null,
                  }
                }
                confirmedSignal={evaluation?.signal || null}
                overlayToggles={overlayToggles}
                onToggleOverlay={handleToggleOverlay}
              />
            )}
          </div>
        </div>

        {/* Right Collapsible Panel (Desktop & Tablet) */}
        {!isChartExpanded && (
          <LiveRightPanel
            isCollapsed={isRightPanelCollapsed}
            onToggleCollapse={() => {
              const next = !isRightPanelCollapsed;
              setIsRightPanelCollapsed(next);
              void saveLivePrefs({ isRightPanelCollapsed: next });
            }}
            evaluationState={evaluation?.state || "WATCHING"}
            checklist={evaluation?.checklist || []}
            passedCount={evaluation?.passedCount || 0}
            totalCount={evaluation?.totalCount || 8}
            mlProbability={evaluation?.mlProbability || null}
            mlThreshold={evaluation?.mlThreshold || 0.6}
            htfBias={evaluation?.htfBias || "NEUTRAL"}
            confirmedSignal={evaluation?.signal || null}
            recentFeedSignals={recentSignals}
            onLoadSignalOnChart={handleLoadSignalOnChart}
            decimals={decimals}
          />
        )}
      </div>

      {/* Mobile Draggable / Bottom Drawer Sheet for Right Panel */}
      {mobileSheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-bg-card border-t border-slate-800 rounded-t-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-white text-xs">Setup &amp; Confluence Drawer</span>
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <LiveRightPanel
                isCollapsed={false}
                onToggleCollapse={() => setMobileSheetOpen(false)}
                evaluationState={evaluation?.state || "WATCHING"}
                checklist={evaluation?.checklist || []}
                passedCount={evaluation?.passedCount || 0}
                totalCount={evaluation?.totalCount || 8}
                mlProbability={evaluation?.mlProbability || null}
                mlThreshold={evaluation?.mlThreshold || 0.6}
                htfBias={evaluation?.htfBias || "NEUTRAL"}
                confirmedSignal={evaluation?.signal || null}
                recentFeedSignals={recentSignals}
                onLoadSignalOnChart={handleLoadSignalOnChart}
                decimals={decimals}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Mobile Bottom Navigation Bar */}
      <LiveMobileNav
        onTogglePanelSheet={() => setMobileSheetOpen((prev) => !prev)}
        passedCount={evaluation?.passedCount || 0}
      />
    </div>
  );
}
