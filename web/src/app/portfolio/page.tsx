"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

const AuthModal = dynamic(() => import("@/components/landing/AuthModal").then((m) => m.AuthModal), {
  ssr: false,
});
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  setDoc,
  updateDoc,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import {
  TrendingUp,
  LogOut,
  Bell,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  Lock,
  Send,
  Zap,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Clock,
  Radio,
  Filter,
  ExternalLink,
  X,
  Check,
  RefreshCw,
  BarChart3,
  LineChart,
  Target,
  ShieldAlert,
  DollarSign,
  Maximize2,
  Star,
  ArrowUpDown,
  MoveUp,
  MoveDown,
} from "lucide-react";

interface WatchlistItem {
  symbol: string;
  token: string;
  name: string;
  assetClass?: "equity" | "crypto";
  exchange?: string;
  tradeTypes: string[];
  addedAt?: any;
}

interface SignalItem {
  id: string;
  symbol: string;
  assetClass?: "equity" | "crypto";
  exchange?: string;
  tradeType: string;
  side: "BUY" | "SELL";
  entry: number;
  sl: number;
  tp: number;
  rr: number;
  confidence: number;
  status: "OPEN" | "TP HIT" | "SL HIT" | "CANCELLED";
  reasons: string[];
  createdAt: string;
  closedAt?: string;
  exitPrice?: number;
}

interface LivePriceItem {
  symbol: string;
  ltp: number;
  changePct: number;
  updatedAt: string;
  lastScanAt: string;
}

interface EngineStatusItem {
  lastHeartbeat: string;
  mode: string;
  version: string;
  marketOpen: boolean;
}

interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  link?: string;
}

interface PerformanceMetrics {
  total_trades: number;
  win_trades: number;
  loss_trades: number;
  open_trades: number;
  win_rate_pct: number;
  avg_rr: number;
  expectancy_r: number;
  profit_factor: number;
  max_drawdown_r: number;
  net_pnl_r: number;
  per_stock: {
    symbol: string;
    total: number;
    wins: number;
    losses: number;
    win_rate_pct: number;
    net_pnl_r: number;
  }[];
}

interface EquityPoint {
  trade_index: number;
  date: string;
  symbol: string;
  trade_type: string;
  status: string;
  pnl_r: number;
  cumulative_r: number;
}

interface BacktestResult {
  symbol: string;
  trade_type: string;
  metrics: {
    win_rate_pct: number;
    profit_factor: number;
    avg_rr: number;
    expectancy_r: number;
    total_trades: number;
  };
  disclaimer: string;
}

interface CandleBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const BACKEND_API_BASE =
  process.env.NEXT_PUBLIC_ENGINE_URL ||
  process.env.NEXT_PUBLIC_ENGINE_API_URL ||
  "http://localhost:8000";

const QUICK_CRYPTO_PAIRS = [
  { symbol: "BTC/USDT", name: "Bitcoin / Tether USDT", token: "BTCUSDT", assetClass: "crypto", exchange: "BINANCE" },
  { symbol: "ETH/USDT", name: "Ethereum / Tether USDT", token: "ETHUSDT", assetClass: "crypto", exchange: "BINANCE" },
  { symbol: "SOL/USDT", name: "Solana / Tether USDT", token: "SOLUSDT", assetClass: "crypto", exchange: "BINANCE" },
  { symbol: "BNB/USDT", name: "BNB / Tether USDT", token: "BNBUSDT", assetClass: "crypto", exchange: "BINANCE" },
];

const SAMPLE_WATCHLIST: WatchlistItem[] = [
  { symbol: "TCS-EQ", token: "11536", name: "Tata Consultancy Services Ltd", assetClass: "equity", exchange: "NSE", tradeTypes: ["intraday", "delivery"] },
  { symbol: "INFY-EQ", token: "1594", name: "Infosys Limited", assetClass: "equity", exchange: "NSE", tradeTypes: ["intraday"] },
  { symbol: "RELIANCE-EQ", token: "2885", name: "Reliance Industries Ltd", assetClass: "equity", exchange: "NSE", tradeTypes: ["swing", "delivery"] },
  { symbol: "HDFCBANK-EQ", token: "1333", name: "HDFC Bank Ltd", assetClass: "equity", exchange: "NSE", tradeTypes: ["intraday"] },
  { symbol: "BTC/USDT", token: "BTCUSDT", name: "Bitcoin / Tether USDT", assetClass: "crypto", exchange: "BINANCE", tradeTypes: ["scalp", "intraday"] },
  { symbol: "ETH/USDT", token: "ETHUSDT", name: "Ethereum / Tether USDT", assetClass: "crypto", exchange: "BINANCE", tradeTypes: ["intraday", "swing"] },
];

const SAMPLE_PRICES: Record<string, LivePriceItem> = {
  "TCS-EQ": { symbol: "TCS-EQ", ltp: 3942.50, changePct: 0.85, updatedAt: new Date().toISOString(), lastScanAt: new Date().toISOString() },
  "INFY-EQ": { symbol: "INFY-EQ", ltp: 1845.20, changePct: 1.42, updatedAt: new Date().toISOString(), lastScanAt: new Date().toISOString() },
  "RELIANCE-EQ": { symbol: "RELIANCE-EQ", ltp: 2984.10, changePct: -0.32, updatedAt: new Date().toISOString(), lastScanAt: new Date().toISOString() },
  "HDFCBANK-EQ": { symbol: "HDFCBANK-EQ", ltp: 1650.00, changePct: 0.45, updatedAt: new Date().toISOString(), lastScanAt: new Date().toISOString() },
  "BTC_USDT": { symbol: "BTC/USDT", ltp: 68420.00, changePct: 2.14, updatedAt: new Date().toISOString(), lastScanAt: new Date().toISOString() },
  "BTC/USDT": { symbol: "BTC/USDT", ltp: 68420.00, changePct: 2.14, updatedAt: new Date().toISOString(), lastScanAt: new Date().toISOString() },
  "ETH_USDT": { symbol: "ETH/USDT", ltp: 3540.50, changePct: 1.65, updatedAt: new Date().toISOString(), lastScanAt: new Date().toISOString() },
  "ETH/USDT": { symbol: "ETH/USDT", ltp: 3540.50, changePct: 1.65, updatedAt: new Date().toISOString(), lastScanAt: new Date().toISOString() },
};

const SAMPLE_SIGNALS: SignalItem[] = [
  {
    id: "sig-sample-1",
    symbol: "RELIANCE-EQ",
    assetClass: "equity",
    exchange: "NSE",
    tradeType: "INTRADAY",
    side: "BUY",
    entry: 2980.00,
    sl: 2955.00,
    tp: 3040.00,
    rr: 2.4,
    confidence: 88,
    status: "OPEN",
    reasons: ["BSL Liquidity Sweep", "5m CHoCH Validated", "Bullish FVG Retest", "VWAP Confluence"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "sig-sample-2",
    symbol: "TCS-EQ",
    assetClass: "equity",
    exchange: "NSE",
    tradeType: "INTRADAY",
    side: "BUY",
    entry: 3920.00,
    sl: 3895.00,
    tp: 3980.00,
    rr: 2.4,
    confidence: 85,
    status: "TP HIT",
    reasons: ["Order Block Mitigation", "15m BOS", "Volume Surge 2.8x"],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    closedAt: new Date().toISOString(),
    exitPrice: 3980.00,
  },
  {
    id: "sig-sample-3",
    symbol: "BTC/USDT",
    assetClass: "crypto",
    exchange: "BINANCE",
    tradeType: "SCALP",
    side: "SELL",
    entry: 68900.00,
    sl: 69200.00,
    tp: 68200.00,
    rr: 2.33,
    confidence: 82,
    status: "OPEN",
    reasons: ["SSL Sweep", "Bearish FVG", "XGBoost 84% Edge"],
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

// Helper: Encode symbol safely for Firestore document IDs (e.g. BTC/USDT -> BTC_USDT, TCS-EQ -> TCS-EQ)
function encodeSymbolDocId(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\//g, "_");
}

function inferAssetClass(symbol: string, explicit?: string): "equity" | "crypto" {
  if (explicit === "crypto" || explicit === "equity") return explicit;
  return symbol.includes("/") || symbol.endsWith("USDT") ? "crypto" : "equity";
}

function formatAssetPrice(price: number | undefined | null, assetClass: "equity" | "crypto", decimalsOverride?: number): string {
  const val = Number(price || 0);
  const curr = assetClass === "crypto" ? "$" : "₹";
  const decimals =
    decimalsOverride !== undefined
      ? decimalsOverride
      : assetClass === "crypto" && val < 1
      ? 4
      : assetClass === "crypto" && val < 10
      ? 3
      : 2;
  return `${curr}${val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

// Helper: Normalize & validate phone number to E.164 (+91 default for 10-digit Indian numbers)
function normalizeE164Phone(raw: string): { valid: boolean; normalized: string; error?: string } {
  let clean = raw.trim().replace(/[\s\-\(\)]/g, "");
  if (!clean) {
    return { valid: false, normalized: "", error: "Please enter a phone number." };
  }
  // Strip leading zero if 11 digits (e.g. 09876543210 -> 9876543210)
  if (clean.startsWith("0") && clean.length === 11) {
    clean = clean.substring(1);
  }
  // Default country India +91 when user types 10 digits
  if (/^\d{10}$/.test(clean)) {
    clean = `+91${clean}`;
  }
  // Check E.164 format: + followed by 8 to 15 digits
  if (!/^\+[1-9]\d{7,14}$/.test(clean)) {
    return {
      valid: false,
      normalized: clean,
      error: "Enter a valid 10-digit number (e.g. 9876543210) or international format (+919876543210).",
    };
  }
  return { valid: true, normalized: clean };
}

// Helper: Map Firestore and network errors to friendly messages
function mapFirestoreError(err: any): { message: string; link?: string } {
  const code = err?.code || "";
  const msg = err?.message || "";

  if (code === "permission-denied" || msg.includes("permission-denied")) {
    return { message: "Permission Denied: Access restricted by security rules." };
  }
  if (code === "unavailable" || msg.includes("unavailable") || msg.includes("network")) {
    return { message: "Network Error: Could not connect to Firestore. Check your internet connection." };
  }
  if (code === "resource-exhausted" || msg.includes("resource-exhausted")) {
    return { message: "Quota Exceeded: Project Firestore request quota reached." };
  }

  // Detect index creation URL in query error
  const match = msg.match(/https:\/\/console\.firebase\.google\.com[^\s\)]+/);
  if (match) {
    return {
      message: "Firestore composite index required for this ordered query.",
      link: match[0],
    };
  }

  return { message: msg || "An unexpected error occurred." };
}

export default function PortfolioPage() {
  const { user, userData, loading, validation, logout, updateUserWhatsApp } = useAuth();
  const router = useRouter();

  // Toast System
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: "success" | "error" | "info", message: string, link?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message, link }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Global Asset Tab Filter (All / Stocks / Crypto)
  const [assetFilter, setAssetFilter] = useState<"ALL" | "equity" | "crypto">("ALL");

  // WhatsApp State
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [phoneInlineError, setPhoneInlineError] = useState<string | null>(null);
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [testSending, setTestSending] = useState(false);

  // Auth Modal State & Resilient Timeouts
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  // Firestore Subscriptions & Error States
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [watchlistRetryKey, setWatchlistRetryKey] = useState(0);
  const [watchlistSearch, setWatchlistSearch] = useState("");
  const [watchlistSort, setWatchlistSort] = useState<"alpha" | "change" | "state">("alpha");
  const [starredSymbols, setStarredSymbols] = useState<Record<string, boolean>>({});

  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [signalsError, setSignalsError] = useState<string | null>(null);
  const [signalsRetryKey, setSignalsRetryKey] = useState(0);
  const [signalsLimit, setSignalsLimit] = useState(50);
  const [indexCreationLink, setIndexCreationLink] = useState<string | null>(null);

  const [livePrices, setLivePrices] = useState<Record<string, LivePriceItem>>({});
  const [engineStatus, setEngineStatus] = useState<EngineStatusItem | null>(null);

  // Symbol Search & Add (Stocks vs Crypto tab)
  const [searchAssetClass, setSearchAssetClass] = useState<"equity" | "crypto">("equity");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any | null>(null);
  const [selectedTradeType, setSelectedTradeType] = useState<string>("both");
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [addStockError, setAddStockError] = useState<string | null>(null);

  // Delete & Edit TradeType States
  const [confirmDeleteSymbol, setConfirmDeleteSymbol] = useState<string | null>(null);
  const [updatingTradeTypeSymbol, setUpdatingTradeTypeSymbol] = useState<string | null>(null);

  // Filters & Row Expand
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Performance & Historical Analytics State (Powered by Supabase Engine)
  const [perfMetrics, setPerfMetrics] = useState<PerformanceMetrics | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfError, setPerfError] = useState<string | null>(null);
  const [perfRetryKey, setPerfRetryKey] = useState(0);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>([]);
  const [equityFilter, setEquityFilter] = useState<string>("ALL");
  const [equityLoading, setEquityLoading] = useState(false);

  // Watchlist Backtest Benchmarks
  const [backtests, setBacktests] = useState<Record<string, BacktestResult>>({});
  const [backtestsLoading, setBacktestsLoading] = useState(false);

  // Setup Candle Chart Modal State
  const [chartSignal, setChartSignal] = useState<SignalItem | null>(null);
  const [chartInterval, setChartInterval] = useState<"5m" | "15m" | "1h" | "4h" | "1d">("5m");
  const [chartCandles, setChartCandles] = useState<CandleBar[]>([]);
  const [chartCandlesLoading, setChartCandlesLoading] = useState(false);
  const [chartCandlesError, setChartCandlesError] = useState<string | null>(null);

  // 1. Auth readiness & Route protection
  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthTimedOut(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("guest") === "true" || params.get("demo") === "true") {
        setGuestMode(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!loading && !user && !guestMode) {
      // Clear personal React state on logout
      setWatchlist([]);
      setSignals([]);
      setLivePrices({});
      setEngineStatus(null);
      setWhatsappPhone("");
      setPhoneInlineError(null);
      setToasts([]);
      setPerfMetrics(null);
      setEquityCurve([]);
      setBacktests({});
      setChartSignal(null);
      setChartCandles([]);
    }
  }, [user, loading, guestMode]);

  // Seed sample data when guest preview is active
  useEffect(() => {
    if (!user && guestMode) {
      setWatchlist(SAMPLE_WATCHLIST);
      setLivePrices(SAMPLE_PRICES);
      setSignals(SAMPLE_SIGNALS);
      setWatchlistLoading(false);
      setSignalsLoading(false);
    }
  }, [user, guestMode]);

  // Fetch Performance metrics from Engine (Supabase-backed, auth verified via Firebase ID token)
  const fetchPerformanceData = async () => {
    if (!user) return;
    setPerfLoading(true);
    setPerfError(null);
    try {
      const token = await user.getIdToken();
      const assetParam = assetFilter !== "ALL" ? `?assetClass=${assetFilter}` : "";
      const res = await fetch(`${BACKEND_API_BASE}/api/performance${assetParam}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        setPerfMetrics(data);
        setPerfError(null);
      } else {
        setPerfError(`Engine returned HTTP ${res.status}`);
      }
    } catch (err: any) {
      console.warn("Performance API fetch error:", err);
      setPerfError(err.name === "TimeoutError" ? "Performance calculation timed out after 8s." : `Backend unreachable at ${BACKEND_API_BASE}`);
    } finally {
      setPerfLoading(false);
    }
  };

  // Fetch Equity Curve timeline from Engine
  const fetchEquityCurveData = async () => {
    if (!user) return;
    setEquityLoading(true);
    try {
      const token = await user.getIdToken();
      const assetParam = assetFilter !== "ALL" ? `&assetClass=${assetFilter}` : "";
      const res = await fetch(
        `${BACKEND_API_BASE}/api/performance/equity-curve?trade_type=${equityFilter}${assetParam}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setEquityCurve(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn("Equity curve API fetch error:", err);
    } finally {
      setEquityLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPerformanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, signals.length, assetFilter]);

  useEffect(() => {
    if (user) {
      fetchEquityCurveData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, equityFilter, signals.length, assetFilter]);

  // Load backtest benchmarks for active watchlist symbols
  useEffect(() => {
    if (!watchlist.length) return;
    let isMounted = true;
    setBacktestsLoading(true);

    const loadBacktests = async () => {
      const results: Record<string, BacktestResult> = {};
      await Promise.all(
        watchlist.map(async (w) => {
          const sym = w.symbol;
          const ac = inferAssetClass(sym, w.assetClass);
          try {
            const res = await fetch(
              `${BACKEND_API_BASE}/api/backtests?symbol=${encodeURIComponent(sym)}&assetClass=${ac}`
            );
            if (res.ok) {
              const data = await res.json();
              results[sym] = data;
            }
          } catch (err) {
            console.warn(`Error fetching backtest for ${sym}:`, err);
          }
        })
      );
      if (isMounted) {
        setBacktests(results);
        setBacktestsLoading(false);
      }
    };

    loadBacktests();
    return () => {
      isMounted = false;
    };
  }, [watchlist]);

  // Load candle bars when modal opens or interval toggles
  useEffect(() => {
    if (!chartSignal) {
      setChartCandles([]);
      setChartCandlesError(null);
      return;
    }

    let isMounted = true;
    setChartCandlesLoading(true);
    setChartCandlesError(null);

    const fetchCandles = async () => {
      try {
        const ac = inferAssetClass(chartSignal.symbol, chartSignal.assetClass);
        const res = await fetch(
          `${BACKEND_API_BASE}/api/candles?symbol=${encodeURIComponent(chartSignal.symbol)}&assetClass=${ac}&interval=${chartInterval}&limit=50`
        );
        if (!res.ok) {
          throw new Error(`Candle data unavailable (${res.status})`);
        }
        const data: CandleBar[] = await res.json();
        if (isMounted) {
          setChartCandles(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setChartCandlesError(err.message || "Failed to retrieve candles from engine cache.");
        }
      } finally {
        if (isMounted) {
          setChartCandlesLoading(false);
        }
      }
    };

    fetchCandles();
    return () => {
      isMounted = false;
    };
  }, [chartSignal, chartInterval]);

  // Sync saved phone number from Firestore userData into input on login/update
  useEffect(() => {
    if (userData?.whatsapp) {
      setWhatsappPhone(userData.whatsapp);
      setPhoneInlineError(null);
    }
  }, [userData?.whatsapp]);

  // 2. Watchlist Firestore Listener: users/{uid}/watchlist
  useEffect(() => {
    if (!user) {
      setWatchlist([]);
      setWatchlistLoading(false);
      setWatchlistError(null);
      return;
    }

    setWatchlistLoading(true);
    setWatchlistError(null);

    const wlTimer = setTimeout(() => {
      setWatchlistLoading((prev) => {
        if (prev) {
          setWatchlistError("Watchlist query timed out after 8s. Check your Firestore connectivity and security rules.");
          return false;
        }
        return prev;
      });
    }, 8000);

    const wlRef = collection(db, "users", user.uid, "watchlist");

    const unsubscribe = onSnapshot(
      wlRef,
      (snapshot) => {
        clearTimeout(wlTimer);
        const items: WatchlistItem[] = [];
        snapshot.forEach((d) => items.push(d.data() as WatchlistItem));
        setWatchlist(items);
        setWatchlistLoading(false);
        setWatchlistError(null);
      },
      (err) => {
        clearTimeout(wlTimer);
        console.error("Watchlist listener error:", err);
        const mapped = mapFirestoreError(err);
        setWatchlistError(`Watchlist Error: ${mapped.message}`);
        setWatchlistLoading(false);
      }
    );

    return () => {
      clearTimeout(wlTimer);
      unsubscribe();
    };
  }, [user, watchlistRetryKey]);

  // 3. Signals Firestore Listener: signals where uid == user.uid, ordered by createdAt desc
  useEffect(() => {
    if (!user) {
      setSignals([]);
      setSignalsLoading(false);
      setSignalsError(null);
      return;
    }

    setSignalsLoading(true);
    setSignalsError(null);

    const sigTimer = setTimeout(() => {
      setSignalsLoading((prev) => {
        if (prev) {
          setSignalsError("Signals feed query timed out after 8s. Check Firestore permissions or security rules.");
          return false;
        }
        return prev;
      });
    }, 8000);

    const sigRef = collection(db, "signals");

    // Ordered query with pagination limit
    const orderedQuery = query(
      sigRef,
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(signalsLimit)
    );

    let fallbackUnsub: (() => void) | null = null;

    const unsubscribe = onSnapshot(
      orderedQuery,
      (snapshot) => {
        clearTimeout(sigTimer);
        const sigList: SignalItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as SignalItem;
          sigList.push({ ...data, id: d.id });
        });
        setSignals(sigList);
        setSignalsLoading(false);
        setSignalsError(null);
      },
      (err) => {
        console.warn("Primary signals query notification:", err);
        const mapped = mapFirestoreError(err);
        if (mapped.link) {
          setIndexCreationLink(mapped.link);
          addToast("info", "Firestore composite index needed. Click to create in Firebase Console.", mapped.link);
        }

        // Fallback: Query where("uid", "==", user.uid) and sort client-side while index builds
        const fallbackQuery = query(sigRef, where("uid", "==", user.uid), limit(signalsLimit));
        fallbackUnsub = onSnapshot(
          fallbackQuery,
          (snap) => {
            clearTimeout(sigTimer);
            const sigList: SignalItem[] = [];
            snap.forEach((d) => {
              sigList.push({ ...(d.data() as SignalItem), id: d.id });
            });
            sigList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setSignals(sigList);
            setSignalsLoading(false);
            setSignalsError(null);
          },
          (err2) => {
            clearTimeout(sigTimer);
            console.error("Signals fallback error:", err2);
            const fallbackMapped = mapFirestoreError(err2);
            setSignalsError(`Signals Error: ${fallbackMapped.message}`);
            setSignalsLoading(false);
          }
        );
      }
    );

    return () => {
      clearTimeout(sigTimer);
      unsubscribe();
      if (fallbackUnsub) fallbackUnsub();
    };
  }, [user, signalsLimit, signalsRetryKey]);

  // 4. Live Prices Firestore Listener: livePrices collection
  useEffect(() => {
    if (!user) return;
    const pricesRef = collection(db, "livePrices");
    const unsubscribe = onSnapshot(
      pricesRef,
      (snapshot) => {
        const map: Record<string, LivePriceItem> = {};
        snapshot.forEach((d) => {
          map[d.id] = d.data() as LivePriceItem;
        });
        setLivePrices(map);
      },
      (err) => {
        console.warn("Live prices stream notice:", err);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // 5. Engine Status Listener: engineStatus/main + Real /api/health endpoint check
  const [engineHealthOnline, setEngineHealthOnline] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const checkEngineHealth = async () => {
      try {
        const res = await fetch(`${BACKEND_API_BASE}/api/health`, {
          cache: "no-store",
        });
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          const st = String(data?.status || "").toUpperCase();
          setEngineHealthOnline(st === "HEALTHY" || st === "ONLINE" || st === "OK");
        } else {
          setEngineHealthOnline(false);
        }
      } catch {
        if (active) setEngineHealthOnline(false);
      }
    };

    void checkEngineHealth();
    const timer = window.setInterval(checkEngineHealth, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const statusRef = doc(db, "engineStatus", "main");
    const unsubscribe = onSnapshot(
      statusRef,
      (snap) => {
        if (snap.exists()) {
          setEngineStatus(snap.data() as EngineStatusItem);
        }
      },
      (err) => {
        console.warn("Engine status notice:", err);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Engine Online Check reads real /api/health endpoint
  const isEngineOnline = engineHealthOnline;

  // NSE Market Open Check (Mon-Fri 09:15-15:30 IST)
  const isMarketOpenNow = useMemo(() => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + istOffset);
    const day = istTime.getDay();
    if (day === 0 || day === 6) return false;
    const totalMinutes = istTime.getHours() * 60 + istTime.getMinutes();
    return totalMinutes >= 9 * 60 + 15 && totalMinutes <= 15 * 60 + 30;
  }, []);

  // Symbol Autocomplete Search (Stocks or Crypto)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `${BACKEND_API_BASE}/api/symbols/search?q=${encodeURIComponent(searchQuery)}&assetClass=${searchAssetClass}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        if (searchAssetClass === "crypto") {
          const qUp = searchQuery.toUpperCase().trim();
          setSearchResults(
            QUICK_CRYPTO_PAIRS.filter(
              (p) => p.symbol.includes(qUp) || p.name.toUpperCase().includes(qUp)
            )
          );
        } else {
          setSearchResults([]);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchQuery, searchAssetClass]);

  // WhatsApp: Save Number
  const handleSavePhone = async () => {
    const check = normalizeE164Phone(whatsappPhone);
    if (!check.valid) {
      setPhoneInlineError(check.error || "Invalid phone number format.");
      return;
    }
    setPhoneInlineError(null);
    setIsSavingPhone(true);

    try {
      await updateUserWhatsApp(check.normalized);
      setWhatsappPhone(check.normalized);
      addToast("success", `WhatsApp number saved as ${check.normalized}.`);
    } catch (err: any) {
      const mapped = mapFirestoreError(err);
      addToast("error", `Failed to save number: ${mapped.message}`);
    } finally {
      setIsSavingPhone(false);
    }
  };

  // WhatsApp: Send Test Alert via Engine Endpoint
  const handleSendTestMessage = async () => {
    if (!user) return;
    const savedPhone = userData?.whatsapp;
    if (!savedPhone) {
      addToast("error", "Please save your WhatsApp number first before sending a test alert.");
      return;
    }

    setTestSending(true);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`${BACKEND_API_BASE}/api/alerts/send-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ recipient: savedPhone }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        addToast(
          "success",
          `Verification alert sent via ${data.notifier_type}! WhatsApp channel is now Connected.`
        );
      } else {
        const errMsg = data.detail || data.message || "Failed to send alert via engine.";
        addToast("error", `Alert Error: ${errMsg}`);
      }
    } catch (err: any) {
      addToast("error", `Network Error: Could not connect to engine at ${BACKEND_API_BASE}.`);
    } finally {
      setTestSending(false);
    }
  };

  // Watchlist: Add Stock or Crypto Pair with Validation
  const handleAddStock = async () => {
    if (!user || !selectedStock || isAddingStock) return;
    setIsAddingStock(true);
    setAddStockError(null);

    const stockSymbol = selectedStock.symbol.toUpperCase().trim();
    const symbolDocId = encodeSymbolDocId(stockSymbol);
    const token = String(selectedStock.token || stockSymbol.replace("/", ""));
    const name = selectedStock.name || stockSymbol;
    const assetClass: "equity" | "crypto" = inferAssetClass(stockSymbol, selectedStock.assetClass || searchAssetClass);
    const exchange = selectedStock.exchange || (assetClass === "crypto" ? "BINANCE" : "NSE");
    const tradeTypes =
      assetClass === "crypto"
        ? selectedTradeType === "all" || selectedTradeType === "both"
          ? ["scalp", "intraday", "swing"]
          : [selectedTradeType]
        : selectedTradeType === "both"
        ? ["intraday", "delivery"]
        : [selectedTradeType];

    try {
      // Validate symbol against engine symbol search
      try {
        const verifyRes = await fetch(
          `${BACKEND_API_BASE}/api/symbols/search?q=${encodeURIComponent(stockSymbol)}&assetClass=${assetClass}`
        );
        if (verifyRes.ok) {
          const verifiedList: any[] = await verifyRes.json();
          const exists = verifiedList.some(
            (s) =>
              s.symbol.toUpperCase() === stockSymbol ||
              s.symbol.toUpperCase() === `${stockSymbol}-EQ`
          );
          if (!exists && verifiedList.length === 0) {
            throw new Error(`Unknown symbol '${stockSymbol}'. Only verified ${assetClass.toUpperCase()} symbols are supported.`);
          }
        }
      } catch (verifyErr: any) {
        if (verifyErr.message?.startsWith("Unknown symbol")) {
          throw verifyErr;
        }
      }

      // Write to users/{uid}/watchlist/{symbolDocId} with encoded symbol as doc ID (duplicates impossible)
      await setDoc(doc(db, "users", user.uid, "watchlist", symbolDocId), {
        symbol: stockSymbol,
        token: token,
        name: name,
        assetClass: assetClass,
        exchange: exchange,
        tradeTypes: tradeTypes,
        addedAt: serverTimestamp(),
      });

      addToast("success", `Added ${stockSymbol} [${exchange}] to active monitored watchlist.`);
      setSelectedStock(null);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err: any) {
      const msg = err.message || "Failed to add symbol.";
      setAddStockError(msg);
      addToast("error", msg);
    } finally {
      setIsAddingStock(false);
    }
  };

  // Dev-only helper: Seed sample multi-asset watchlist items (only visible in NODE_ENV === 'development')
  const handleLoadSampleWatchlist = async () => {
    if (!user || process.env.NODE_ENV !== "development") return;
    try {
      const samples = [
        { symbol: "TCS-EQ", token: "11536", name: "TATA CONSULTANCY SERV LT", assetClass: "equity", exchange: "NSE", tradeTypes: ["intraday", "delivery"] },
        { symbol: "BTC/USDT", token: "BTCUSDT", name: "Bitcoin / Tether USDT", assetClass: "crypto", exchange: "BINANCE", tradeTypes: ["scalp", "intraday", "swing"] },
        { symbol: "ETH/USDT", token: "ETHUSDT", name: "Ethereum / Tether USDT", assetClass: "crypto", exchange: "BINANCE", tradeTypes: ["intraday", "swing"] },
      ];
      for (const s of samples) {
        await setDoc(doc(db, "users", user.uid, "watchlist", encodeSymbolDocId(s.symbol)), {
          ...s,
          addedAt: serverTimestamp(),
        });
      }
      addToast("success", "Loaded sample Stocks + Crypto pairs into your Firestore watchlist.");
    } catch (err: any) {
      addToast("error", `Failed to seed sample watchlist: ${err.message}`);
    }
  };

  // Watchlist: Update Trade Types on Card
  const handleUpdateTradeTypes = async (symbol: string, newTypes: string[]) => {
    if (!user || updatingTradeTypeSymbol) return;
    setUpdatingTradeTypeSymbol(symbol);
    try {
      const symbolDocId = encodeSymbolDocId(symbol);
      await updateDoc(doc(db, "users", user.uid, "watchlist", symbolDocId), {
        tradeTypes: newTypes,
      });
      addToast("success", `Updated strategy for ${symbol} to ${newTypes.join(" & ").toUpperCase()}.`);
    } catch (err: any) {
      const mapped = mapFirestoreError(err);
      addToast("error", `Failed to update trade types: ${mapped.message}`);
    } finally {
      setUpdatingTradeTypeSymbol(null);
    }
  };

  // Watchlist: Remove Stock
  const handleConfirmRemoveStock = async (symbol: string) => {
    if (!user) return;
    try {
      const symbolDocId = encodeSymbolDocId(symbol);
      await deleteDoc(doc(db, "users", user.uid, "watchlist", symbolDocId));
      addToast("success", `Removed ${symbol} from watchlist.`);
    } catch (err: any) {
      const mapped = mapFirestoreError(err);
      addToast("error", `Failed to remove ${symbol}: ${mapped.message}`);
    } finally {
      setConfirmDeleteSymbol(null);
    }
  };

  // Watchlist filtered by top-level asset tab, search input, and sort order
  const filteredWatchlist = useMemo(() => {
    let items = assetFilter === "ALL" 
      ? [...watchlist] 
      : watchlist.filter((item) => inferAssetClass(item.symbol, item.assetClass) === assetFilter);

    if (watchlistSearch.trim()) {
      const q = watchlistSearch.toLowerCase();
      items = items.filter(
        (it) => it.symbol.toLowerCase().includes(q) || it.name.toLowerCase().includes(q)
      );
    }

    // Sort items
    items.sort((a, b) => {
      // Starred items priority
      const aStar = starredSymbols[a.symbol] ? 1 : 0;
      const bStar = starredSymbols[b.symbol] ? 1 : 0;
      if (aStar !== bStar) return bStar - aStar;

      if (watchlistSort === "alpha") {
        return a.symbol.localeCompare(b.symbol);
      } else if (watchlistSort === "change") {
        const aChg = livePrices[a.symbol]?.changePct ?? 0;
        const bChg = livePrices[b.symbol]?.changePct ?? 0;
        return bChg - aChg;
      } else if (watchlistSort === "state") {
        const aSig = signals.find((s) => s.symbol === a.symbol && s.status === "OPEN");
        const bSig = signals.find((s) => s.symbol === b.symbol && s.status === "OPEN");
        const aVal = aSig ? 2 : 0;
        const bVal = bSig ? 2 : 0;
        return bVal - aVal;
      }
      return 0;
    });

    return items;
  }, [watchlist, assetFilter, watchlistSearch, watchlistSort, starredSymbols, livePrices, signals]);

  const toggleStar = (sym: string) => {
    setStarredSymbols((prev) => ({ ...prev, [sym]: !prev[sym] }));
  };

  const handleMoveItem = (index: number, direction: "up" | "down") => {
    setWatchlist((prev) => {
      const next = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  // Real Stats Computed from Real Signal Docs (respecting assetFilter)
  const stats = useMemo(() => {
    const scoped =
      assetFilter === "ALL"
        ? signals
        : signals.filter((s) => inferAssetClass(s.symbol, s.assetClass) === assetFilter);
    const total = scoped.length;
    const tpHit = scoped.filter((s) => s.status === "TP HIT").length;
    const slHit = scoped.filter((s) => s.status === "SL HIT").length;
    const open = scoped.filter((s) => s.status === "OPEN").length;
    const closed = tpHit + slHit;
    const winRate = closed > 0 ? ((tpHit / closed) * 100).toFixed(1) : "0.0";
    return { total, tpHit, slHit, open, winRate };
  }, [signals, assetFilter]);

  // Filtered Signals
  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      const ac = inferAssetClass(s.symbol, s.assetClass);
      const matchAsset = assetFilter === "ALL" || ac === assetFilter;
      const matchStatus = statusFilter === "ALL" || s.status === statusFilter;
      const matchType = typeFilter === "ALL" || s.tradeType.toUpperCase() === typeFilter.toUpperCase();
      return matchAsset && matchStatus && matchType;
    });
  }, [signals, assetFilter, statusFilter, typeFilter]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // WhatsApp Badge Status
  const isWhatsAppSaved = Boolean(userData?.whatsapp);
  const isWhatsAppConnected = Boolean(userData?.whatsapp && userData?.whatsappVerified);

  // Helper: Render SVG Candle Chart for setup modal
  const renderCandleChart = () => {
    if (chartCandlesLoading) {
      return (
        <div className="h-72 flex items-center justify-center text-slate-400 font-mono text-xs">
          <RefreshCw className="w-5 h-5 animate-spin mr-2 text-brand-teal" />
          Loading OHLCV candles from Supabase engine cache...
        </div>
      );
    }

    if (chartCandlesError) {
      return (
        <div className="h-72 flex flex-col items-center justify-center text-rose-400 font-mono text-xs gap-2">
          <AlertCircle className="w-6 h-6 text-rose-400" />
          <span>{chartCandlesError}</span>
        </div>
      );
    }

    if (!chartCandles.length) {
      return (
        <div className="h-72 flex flex-col items-center justify-center text-slate-500 font-mono text-xs">
          <Activity className="w-6 h-6 text-slate-600 mb-2" />
          <span>No historical candle bars returned for {chartSignal?.symbol}.</span>
        </div>
      );
    }

    const sig = chartSignal!;
    const sigAssetClass = inferAssetClass(sig.symbol, sig.assetClass);
    const candlePrices = chartCandles.flatMap((c) => [c.low, c.high]);
    const allLevels = [...candlePrices, sig.entry, sig.sl, sig.tp].filter((p) => p > 0);
    const minP = Math.min(...allLevels) * 0.998;
    const maxP = Math.max(...allLevels) * 1.002;
    const pRange = maxP - minP || 1;

    const width = 800;
    const height = 340;
    const padLeft = 20;
    const padRight = 95;
    const padTop = 25;
    const padBottom = 30;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const getY = (price: number) => {
      return padTop + (1 - (price - minP) / pRange) * chartH;
    };

    const candleSpacing = chartW / chartCandles.length;
    const bodyW = Math.max(2, Math.min(10, candleSpacing * 0.7));

    return (
      <div className="w-full overflow-x-auto bg-brand-dark/90 rounded-xl p-2 border border-slate-800">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[650px] font-mono select-none">
          {/* Background Grid */}
          <line x1={padLeft} y1={padTop} x2={width - padRight} y2={padTop} stroke="#334155" strokeDasharray="2 4" strokeWidth="0.5" />
          <line x1={padLeft} y1={padTop + chartH / 2} x2={width - padRight} y2={padTop + chartH / 2} stroke="#334155" strokeDasharray="2 4" strokeWidth="0.5" />
          <line x1={padLeft} y1={padTop + chartH} x2={width - padRight} y2={padTop + chartH} stroke="#334155" strokeDasharray="2 4" strokeWidth="0.5" />

          {/* Candle Bars */}
          {chartCandles.map((c, idx) => {
            const cx = padLeft + (idx + 0.5) * candleSpacing;
            const openY = getY(c.open);
            const closeY = getY(c.close);
            const highY = getY(c.high);
            const lowY = getY(c.low);
            const isGreen = c.close >= c.open;
            const color = isGreen ? "#10B981" : "#F43F5E";
            const topBody = Math.min(openY, closeY);
            const bodyH = Math.max(1.5, Math.abs(closeY - openY));

            return (
              <g key={idx}>
                <line x1={cx} y1={highY} x2={cx} y2={lowY} stroke={color} strokeWidth="1.2" />
                <rect
                  x={cx - bodyW / 2}
                  y={topBody}
                  width={bodyW}
                  height={bodyH}
                  fill={color}
                  stroke={color}
                  strokeWidth="0.5"
                  rx="0.5"
                />
              </g>
            );
          })}

          {/* Setup Level: Take Profit (TP) */}
          {sig.tp > 0 && (
            <g>
              <line
                x1={padLeft}
                y1={getY(sig.tp)}
                x2={width - padRight}
                y2={getY(sig.tp)}
                stroke="#10B981"
                strokeDasharray="4 3"
                strokeWidth="1.5"
              />
              <rect
                x={width - padRight + 4}
                y={getY(sig.tp) - 9}
                width={86}
                height={18}
                fill="#064e3b"
                rx={4}
                stroke="#10B981"
                strokeWidth="0.8"
              />
              <text
                x={width - padRight + 8}
                y={getY(sig.tp) + 3}
                fill="#34d399"
                fontSize="9"
                fontWeight="bold"
              >
                TP: {formatAssetPrice(sig.tp, sigAssetClass)}
              </text>
            </g>
          )}

          {/* Setup Level: Entry */}
          {sig.entry > 0 && (
            <g>
              <line
                x1={padLeft}
                y1={getY(sig.entry)}
                x2={width - padRight}
                y2={getY(sig.entry)}
                stroke="#00F2FE"
                strokeDasharray="4 3"
                strokeWidth="1.5"
              />
              <rect
                x={width - padRight + 4}
                y={getY(sig.entry) - 9}
                width={86}
                height={18}
                fill="#083344"
                rx={4}
                stroke="#00F2FE"
                strokeWidth="0.8"
              />
              <text
                x={width - padRight + 8}
                y={getY(sig.entry) + 3}
                fill="#67e8f9"
                fontSize="9"
                fontWeight="bold"
              >
                IN: {formatAssetPrice(sig.entry, sigAssetClass)}
              </text>
            </g>
          )}

          {/* Setup Level: Stop Loss (SL) */}
          {sig.sl > 0 && (
            <g>
              <line
                x1={padLeft}
                y1={getY(sig.sl)}
                x2={width - padRight}
                y2={getY(sig.sl)}
                stroke="#F43F5E"
                strokeDasharray="4 3"
                strokeWidth="1.5"
              />
              <rect
                x={width - padRight + 4}
                y={getY(sig.sl) - 9}
                width={86}
                height={18}
                fill="#4c0519"
                rx={4}
                stroke="#F43F5E"
                strokeWidth="0.8"
              />
              <text
                x={width - padRight + 8}
                y={getY(sig.sl) + 3}
                fill="#fda4af"
                fontSize="9"
                fontWeight="bold"
              >
                SL: {formatAssetPrice(sig.sl, sigAssetClass)}
              </text>
            </g>
          )}

          {/* X-axis date labels */}
          {chartCandles.length > 0 && (
            <>
              <text x={padLeft} y={height - 10} fill="#64748b" fontSize="9">
                {new Date(chartCandles[0].time).toLocaleDateString([], { month: "short", day: "numeric" })}
              </text>
              <text x={width - padRight - 50} y={height - 10} fill="#64748b" fontSize="9">
                {new Date(chartCandles[chartCandles.length - 1].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </text>
            </>
          )}
        </svg>
      </div>
    );
  };

  // Helper: Render SVG Cumulative Equity Curve
  const renderEquityCurve = () => {
    if (equityLoading) {
      return (
        <div className="h-48 flex items-center justify-center text-slate-400 font-mono text-xs">
          <RefreshCw className="w-5 h-5 animate-spin mr-2 text-brand-teal" />
          Calculating cumulative R equity curve from Supabase...
        </div>
      );
    }

    if (!equityCurve.length) {
      return (
        <div className="h-44 flex flex-col items-center justify-center text-slate-500 font-mono text-xs text-center p-4">
          <Activity className="w-8 h-8 text-slate-600 mb-2" />
          <p>No closed trade outcomes available for trade type &quot;{equityFilter}&quot;.</p>
          <p className="text-[11px] text-slate-600 mt-1">Equity curve updates automatically upon trade resolution.</p>
        </div>
      );
    }

    const width = 700;
    const height = 220;
    const padLeft = 45;
    const padRight = 30;
    const padTop = 20;
    const padBottom = 30;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const rValues = equityCurve.map((p) => p.cumulative_r);
    const minR = Math.min(0, Math.min(...rValues) - 0.5);
    const maxR = Math.max(1, Math.max(...rValues) + 0.5);
    const rRange = maxR - minR || 1;

    const getX = (idx: number) => padLeft + (idx / Math.max(1, equityCurve.length - 1)) * chartW;
    const getY = (val: number) => padTop + (1 - (val - minR) / rRange) * chartH;
    const zeroY = getY(0);

    const linePoints = equityCurve.map((pt, idx) => `${getX(idx)},${getY(pt.cumulative_r)}`).join(" L ");
    const linePath = `M ${linePoints}`;
    const areaPath = `M ${getX(0)},${zeroY} L ${linePoints} L ${getX(equityCurve.length - 1)},${zeroY} Z`;

    return (
      <div className="w-full overflow-x-auto bg-brand-dark/60 rounded-xl p-3 border border-slate-800">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[550px] font-mono select-none">
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#00F2FE" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padLeft} y1={getY(maxR)} x2={width - padRight} y2={getY(maxR)} stroke="#334155" strokeDasharray="2 4" strokeWidth="0.5" />
          <text x={padLeft - 8} y={getY(maxR) + 3} fill="#64748b" fontSize="9" textAnchor="end">+{maxR.toFixed(1)}R</text>

          <line x1={padLeft} y1={zeroY} x2={width - padRight} y2={zeroY} stroke="#64748b" strokeDasharray="3 3" strokeWidth="1" />
          <text x={padLeft - 8} y={zeroY + 3} fill="#94a3b8" fontSize="9" textAnchor="end" fontWeight="bold">0.0R</text>

          {minR < 0 && (
            <>
              <line x1={padLeft} y1={getY(minR)} x2={width - padRight} y2={getY(minR)} stroke="#334155" strokeDasharray="2 4" strokeWidth="0.5" />
              <text x={padLeft - 8} y={getY(minR) + 3} fill="#64748b" fontSize="9" textAnchor="end">{minR.toFixed(1)}R</text>
            </>
          )}

          {/* Gradient Area */}
          <path d={areaPath} fill="url(#equityGrad)" />

          {/* Curve Line */}
          <path d={linePath} fill="none" stroke="#00F2FE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Trade Points */}
          {equityCurve.map((pt, idx) => {
            const cx = getX(idx);
            const cy = getY(pt.cumulative_r);
            const isWin = pt.pnl_r > 0;
            return (
              <g key={idx} className="group cursor-pointer">
                <circle cx={cx} cy={cy} r={3.5} fill={isWin ? "#10B981" : "#F43F5E"} stroke="#0f172a" strokeWidth="1.5" />
                <title>{`#${pt.trade_index} ${pt.symbol} (${pt.trade_type}): ${pt.pnl_r >= 0 ? "+" : ""}${pt.pnl_r}R -> Total ${pt.cumulative_r}R`}</title>
              </g>
            );
          })}

          {/* X-axis labels */}
          <text x={padLeft} y={height - 8} fill="#64748b" fontSize="9">Trade #1</text>
          <text x={width - padRight} y={height - 8} fill="#64748b" fontSize="9" textAnchor="end">Trade #{equityCurve.length}</text>
        </svg>
      </div>
    );
  };

  // Loading Skeleton State (Max 8 seconds before offering retry/error fallback)
  if (loading && !authTimedOut && !guestMode) {
    return (
      <div className="flex-1 flex flex-col bg-[#F4F5F8] dark:bg-[#060A14] min-h-screen text-[#111827] dark:text-slate-100">
        <header className="border-b border-[#E5E7EB] dark:border-white/10 bg-white dark:bg-[#0E1422] h-[60px] flex items-center justify-between px-6 sm:px-12">
          <div className="w-32 h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="w-24 h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        </header>
        <div className="max-w-[1920px] mx-auto px-6 sm:px-12 py-8 space-y-6 w-full animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-20 bg-white dark:bg-[#0E1422] rounded-xl border border-[#E5E7EB] dark:border-white/10" />
            ))}
          </div>
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 h-56 bg-white dark:bg-[#0E1422] rounded-xl border border-[#E5E7EB] dark:border-white/10" />
            <div className="lg:col-span-7 h-56 bg-white dark:bg-[#0E1422] rounded-xl border border-[#E5E7EB] dark:border-white/10" />
          </div>
          <div className="h-44 bg-white dark:bg-[#0E1422] rounded-xl border border-[#E5E7EB] dark:border-white/10" />
          <div className="h-80 bg-white dark:bg-[#0E1422] rounded-xl border border-[#E5E7EB] dark:border-white/10" />
        </div>
      </div>
    );
  }

  // Auth Timeout State (8 seconds exceeded without resolving)
  if (loading && authTimedOut) {
    return (
      <div className="flex-1 flex flex-col bg-[#F4F5F8] dark:bg-[#060A14] min-h-screen text-[#111827] dark:text-slate-100">
        <header className="border-b border-[#E5E7EB] dark:border-white/10 bg-white dark:bg-[#0E1422] h-[60px] flex items-center justify-between px-6 sm:px-12">
          <Link href="/" className="font-bold text-lg text-[#111827] dark:text-white">
            Signal<span className="text-[#1F5BFF]">Desk</span>
          </Link>
          <Link href="/live" className="text-xs font-semibold text-[#1F5BFF] hover:underline">
            Open Terminal →
          </Link>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full p-8 rounded-2xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-[#111827] dark:text-white">Connection Timeout</h2>
            <p className="text-xs text-[#4B5563] dark:text-slate-400 leading-relaxed font-mono">
              Authentication state took longer than 8s to resolve. (Firebase Auth or backend on :8000 may be unreachable).
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  setAuthTimedOut(false);
                  window.location.reload();
                }}
                className="px-5 py-2.5 rounded-xl bg-[#1F5BFF] text-white text-xs font-semibold hover:bg-[#1848cc] transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-[#E8F0FE] text-[#1F5BFF] text-xs font-semibold hover:bg-[#d8e7fe] transition"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
        {authModalOpen && <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />}
      </div>
    );
  }

  // Explicit Authentication Required screen
  if (!user && !guestMode) {
    return (
      <div className="flex-1 flex flex-col bg-[#F4F5F8] dark:bg-[#060A14] min-h-screen text-[#111827] dark:text-slate-100">
        <header className="border-b border-[#E5E7EB] dark:border-white/10 bg-white dark:bg-[#0E1422] h-[60px] flex items-center justify-between px-6 sm:px-12">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-[#111827] dark:text-white text-lg">
              Signal<span className="text-[#1F5BFF]">Desk</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/live"
              className="text-xs font-semibold text-[#4B5563] hover:text-[#111827] dark:text-slate-300 px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-white/10 transition"
            >
              Open Live Terminal →
            </Link>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="h-[36px] px-4 rounded-lg bg-[#1F5BFF] text-white font-semibold text-xs hover:bg-[#1848cc] transition"
            >
              Sign In
            </button>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full p-8 rounded-2xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-[#E8F0FE] text-[#1F5BFF] flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#111827] dark:text-white">Authentication Required</h2>
            <p className="text-xs text-[#4B5563] dark:text-slate-400 leading-relaxed">
              Sign in to access your monitored portfolio, stream live NSE/Crypto prices, and configure real-time WhatsApp signals.
            </p>
            <div className="pt-2 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="w-full h-[44px] rounded-xl bg-[#1F5BFF] text-white font-semibold text-xs hover:bg-[#1848cc] transition"
              >
                Sign In / Register
              </button>
              <button
                type="button"
                onClick={() => setGuestMode(true)}
                className="w-full h-[40px] rounded-xl bg-[#E8F0FE] dark:bg-blue-950/40 text-[#1F5BFF] font-semibold text-xs hover:bg-[#d8e7fe] transition"
              >
                Explore Sample Watchlist (Guest Preview)
              </button>
              <Link
                href="/live"
                className="w-full h-[40px] rounded-xl border border-[#E5E7EB] dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#4B5563] dark:text-slate-300 font-semibold text-xs flex items-center justify-center transition"
              >
                View Live Market Terminal (Free)
              </Link>
            </div>
          </div>
        </div>

        {authModalOpen && <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F4F5F8] dark:bg-[#060A14] text-[#111827] dark:text-slate-100 min-h-screen">
      {/* Guest Mode Notice Banner */}
      {guestMode && (
        <div className="bg-[#E8F0FE] dark:bg-blue-950/40 border-b border-[#1F5BFF]/30 px-6 py-2.5 text-xs text-[#1F5BFF] dark:text-blue-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="font-medium">
              Sample Watchlist Preview (Demo data) — Showing sample NSE equities and Crypto pairs. Sign in to monitor your personal assets and configure WhatsApp notifications.
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-3 py-1 bg-[#1F5BFF] text-white rounded-lg text-xs font-semibold hover:bg-[#1848cc] transition"
              >
                Sign In / Register
              </button>
              <button
                type="button"
                onClick={() => setGuestMode(false)}
                className="px-2 py-1 text-xs text-[#4B5563] hover:text-[#111827] dark:text-slate-400"
              >
                Exit Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-xl flex items-start justify-between gap-3 text-xs transition-all animate-in fade-in slide-in-from-bottom-2 ${
              toast.type === "success"
                ? "bg-slate-900/95 border-emerald-500/40 text-emerald-300"
                : toast.type === "error"
                ? "bg-slate-900/95 border-rose-500/40 text-rose-300"
                : "bg-slate-900/95 border-sky-500/40 text-sky-300"
            }`}
          >
            <div className="flex items-start gap-2.5">
              {toast.type === "success" && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
              {toast.type === "error" && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
              {toast.type === "info" && <AlertCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />}
              <div className="space-y-1">
                <span className="leading-relaxed">{toast.message}</span>
                {toast.link && (
                  <div>
                    <a
                      href={toast.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-[#1F5BFF] underline mt-1 hover:text-blue-400"
                    >
                      Open Firebase Console Index Link <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-500 hover:text-white transition p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Configuration Error Banner */}
      {!validation.isValid && (
        <div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-3 text-xs text-rose-600 dark:text-rose-300">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>
                <strong>Firebase Configuration Error:</strong> Missing or malformed:{" "}
                <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-rose-600 dark:text-white font-mono">
                  {validation.missingVars.join(", ")}
                </code>{" "}
                in <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-rose-600 dark:text-white font-mono">web/.env.local</code>.
              </span>
            </div>
            <a
              href="/setup-check"
              className="text-[#1F5BFF] hover:underline font-mono text-[11px] shrink-0"
            >
              Run Setup Diagnostics &rarr;
            </a>
          </div>
        </div>
      )}

      {/* Index Creation Banner (if required by Firestore) */}
      {indexCreationLink && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                <strong>Firestore Composite Index Required:</strong> Click the link to enable ordered sorting for signals in your Firebase project.
              </span>
            </div>
            <a
              href={indexCreationLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-amber-800 dark:text-amber-200 font-mono text-[11px] shrink-0 transition"
            >
              Create Index in Firebase Console <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="border-b border-[#E5E7EB] dark:border-white/10 bg-white dark:bg-[#0E1422] sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-[#1F5BFF]">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-[#111827] dark:text-white font-sans">
                  Signal<span className="text-[#1F5BFF]">Desk</span>
                </span>
                <span className="hidden lg:inline-block ml-2 text-[10px] text-[#4B5563] dark:text-slate-400 font-mono">
                  Multi-Asset Quant Desk (NSE + 24/7 Crypto)
                </span>
              </div>
            </div>

            <nav className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-800">
              <a
                href="/portfolio"
                className="px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-[#1F5BFF] text-white"
              >
                Portfolio
              </a>
              <a
                href="/live"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono text-[#4B5563] hover:text-[#111827] dark:text-slate-300 dark:hover:text-white transition"
              >
                <Radio className="w-3.5 h-3.5 text-[#1F5BFF]" />
                Live Analysis
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3.5">
            {/* Global Asset Class Filter Tabs */}
            <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-800">
              {([
                { id: "ALL", label: "All Assets" },
                { id: "equity", label: "Stocks (NSE)" },
                { id: "crypto", label: "Crypto (24/7)" },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAssetFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition ${
                    assetFilter === tab.id
                      ? "bg-[#1F5BFF] text-white"
                      : "text-[#4B5563] hover:text-[#111827] dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Live Engine Status Badge */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
                isEngineOnline
                  ? "bg-emerald-500/10 text-[#16C784] border-emerald-500/30"
                  : "bg-rose-500/10 text-[#EA3943] border-rose-500/30"
              }`}
              title={
                isEngineOnline
                  ? `Engine heartbeat verified (${engineStatus?.mode || "PAPER"} mode)`
                  : "Engine heartbeat inactive. Ensure backend uvicorn process is running."
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isEngineOnline ? "bg-[#16C784] animate-pulse" : "bg-[#EA3943]"
                }`}
              />
              <span className="font-semibold">{isEngineOnline ? "Engine Online" : "Engine Offline"}</span>
            </div>

            {/* User identity & sign out */}
            <div className="text-right hidden md:block">
              <div className="text-xs font-medium text-[#111827] dark:text-slate-200">
                {user?.email || "Guest Preview"}
              </div>
              <div className="text-[10px] text-[#4B5563] dark:text-slate-400 font-mono">
                {userData?.displayName ? userData.displayName : user ? "Live Quant Account" : "Sample Mode"}
              </div>
            </div>

            <button
              onClick={() => (user ? logout() : setGuestMode(false))}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#4B5563] dark:text-slate-400 hover:text-[#111827] dark:hover:text-white transition border border-[#E5E7EB] dark:border-white/10"
              title={user ? "Sign Out" : "Exit Preview"}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1 w-full">
        {/* Row 1: Live Market Strip */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400 uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5 text-brand-teal" />
              <span>Live Watchlist Market Strip</span>
              <span className="text-slate-600">•</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                  isMarketOpenNow
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {isMarketOpenNow ? "NSE Open (09:15-15:30 IST)" : "NSE Closed"}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                Crypto 24/7 Active
              </span>
            </div>

            {/* Mobile Asset Filter Tabs */}
            <div className="flex sm:hidden items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
              {(["ALL", "equity", "crypto"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAssetFilter(tab)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                    assetFilter === tab ? "bg-brand-teal text-brand-dark" : "text-slate-400"
                  }`}
                >
                  {tab === "ALL" ? "ALL" : tab.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Market Strip Cards */}
          {watchlistLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-slate-800/40 animate-pulse border border-slate-800" />
              ))}
            </div>
          ) : watchlistError ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{watchlistError}</span>
              </div>
              <button
                type="button"
                onClick={() => setWatchlistRetryKey((k) => k + 1)}
                className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-mono transition flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          ) : filteredWatchlist.length === 0 ? (
            <div className="p-3.5 rounded-2xl bg-[#F9FAFB] dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 text-center text-xs text-[#4B5563] dark:text-slate-400">
              Add NSE stocks or 24/7 Crypto USDT pairs to your watchlist below to stream live prices and scan confluences.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredWatchlist.map((item) => {
                const docId = encodeSymbolDocId(item.symbol);
                const quote = livePrices[docId] || livePrices[item.symbol];
                const ac = inferAssetClass(item.symbol, item.assetClass);
                const exch = item.exchange || (ac === "crypto" ? "BINANCE" : "NSE");
                const hasQuote = Boolean(quote && quote.ltp > 0);
                const isPositive = quote ? quote.changePct >= 0 : false;
                const isStale = quote
                  ? Date.now() - new Date(quote.updatedAt).getTime() > 120000
                  : false;

                return (
                  <div
                    key={item.symbol}
                    className="p-3 rounded-2xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 shadow-sm space-y-1 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold font-mono text-xs text-[#111827] dark:text-white truncate">{item.symbol}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                          ac === "crypto"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30"
                            : "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30"
                        }`}
                      >
                        {ac === "crypto" ? `CRYPTO·${exch}` : exch}
                      </span>
                    </div>

                    {hasQuote ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-bold font-mono text-[#111827] dark:text-white">
                            {formatAssetPrice(quote.ltp, ac)}
                          </div>
                          {isStale && (
                            <span
                              className="text-[9px] text-amber-500 font-mono"
                              title="Quote older than 2 minutes"
                            >
                              Stale
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-[10px] font-mono font-semibold flex items-center gap-0.5 ${
                            isPositive ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          <span>
                            {isPositive ? "+" : ""}
                            {quote.changePct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-xs text-[#6B7280] dark:text-slate-500 font-mono">Monitoring...</div>
                        <div className="text-[10px] text-[#9CA3AF] dark:text-slate-600">
                          {ac === "crypto" ? "24/7 Scan active" : "Scan queued"}
                        </div>
                      </div>
                    )}

                    <div className="pt-1 border-t border-[#E5E7EB] dark:border-white/10 text-[9px] text-[#6B7280] dark:text-slate-500 truncate font-mono">
                      {item.tradeTypes.join(", ").toUpperCase()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Row 2: WhatsApp Channel Card & Performance Stats */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* WhatsApp Channel Card */}
          <div className="lg:col-span-5 p-5 rounded-2xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 shadow-sm flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <Bell className="w-4 h-4" />
                  </div>
                  <h2 className="font-semibold text-[#111827] dark:text-white text-sm">WhatsApp Alert Channel</h2>
                </div>

                {/* Badge based on real persistent state: Action Required / Saved / Connected */}
                <span
                  className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                    isWhatsAppConnected
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : isWhatsAppSaved
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      : "bg-[#F3F4F6] text-[#6B7280] dark:bg-slate-800 dark:text-slate-400 border-[#E5E7EB] dark:border-slate-700"
                  }`}
                >
                  {isWhatsAppConnected
                    ? "Connected"
                    : isWhatsAppSaved
                    ? "Saved"
                    : "Action Required"}
                </span>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-slate-400 leading-relaxed">
                Receive instant Stocks &amp; 24/7 Crypto trade setups on WhatsApp. Normalised to E.164. Connected status is verified exclusively by the backend service.
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <div className="space-y-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={whatsappPhone}
                    onChange={(e) => {
                      setWhatsappPhone(e.target.value);
                      if (phoneInlineError) setPhoneInlineError(null);
                    }}
                    placeholder="+919876543210 (or 10 digits)"
                    className={`flex-1 px-3 py-2 rounded-xl bg-[#F9FAFB] dark:bg-[#060A14] border text-xs text-[#111827] dark:text-white placeholder-[#9CA3AF] focus:outline-none transition font-mono ${
                      phoneInlineError
                        ? "border-rose-500 focus:border-rose-400"
                        : "border-[#E5E7EB] dark:border-white/10 focus:border-[#1F5BFF]"
                    }`}
                  />
                  <button
                    onClick={handleSavePhone}
                    disabled={isSavingPhone}
                    className="px-3.5 py-2 rounded-xl bg-[#111827] hover:bg-black text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold dark:text-slate-200 transition border border-[#111827] dark:border-slate-700 disabled:opacity-50"
                  >
                    {isSavingPhone ? "Saving..." : "Save Number"}
                  </button>
                </div>
                {phoneInlineError && (
                  <p className="text-[11px] text-rose-500 font-mono">{phoneInlineError}</p>
                )}
              </div>

              {/* Send Test Alert: Enabled ONLY when a number is saved */}
              <button
                onClick={handleSendTestMessage}
                disabled={testSending || !isWhatsAppSaved}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-semibold text-emerald-700 dark:text-emerald-300 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                title={
                  !isWhatsAppSaved
                    ? "Save a WhatsApp phone number first to enable test alert dispatch."
                    : "Dispatch a verification alert through engine backend"
                }
              >
                <Send className="w-3.5 h-3.5" />
                {testSending ? "Dispatching Alert via Engine..." : "Send Test Alert"}
              </button>
            </div>
          </div>

          {/* Performance Stats Cards */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-mono text-[#6B7280] dark:text-slate-400 uppercase tracking-wider">Total Setups</span>
              <div className="text-2xl font-bold font-mono text-[#111827] dark:text-white mt-2">{stats.total}</div>
              <span className="text-[10px] text-[#9CA3AF] dark:text-slate-500 mt-1">Generated by engine</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-mono text-[#6B7280] dark:text-slate-400 uppercase tracking-wider">Target Hit</span>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-2">{stats.tpHit}</div>
              <span className="text-[10px] text-emerald-600/80 mt-1">TP Hit setups</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-mono text-[#6B7280] dark:text-slate-400 uppercase tracking-wider">Stop Loss Hit</span>
              <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-2">{stats.slHit}</div>
              <span className="text-[10px] text-rose-500/80 mt-1">Controlled invalidations</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#0E1422] border border-[#1F5BFF]/30 dark:border-brand-teal/30 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] font-mono text-[#1F5BFF] dark:text-brand-teal uppercase tracking-wider font-semibold">
                Win Rate
              </span>
              <div className="text-2xl font-bold font-mono text-[#111827] dark:text-white mt-2">{stats.winRate}%</div>
              <span className="text-[10px] text-[#1F5BFF]/80 dark:text-brand-teal/80 mt-1">{stats.open} Active / Open</span>
            </div>
          </div>
        </div>

        {/* Row 3: Active Watchlist Manager (Stocks + Crypto Tabs) */}
        <div className="p-6 rounded-2xl bg-brand-surface/90 border border-brand-border space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-base font-bold text-white font-display">Active Monitored Watchlist</h3>
                {/* Stocks / Crypto Selector for Adding Symbols */}
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-brand-dark border border-slate-800">
                  <button
                    onClick={() => {
                      setSearchAssetClass("equity");
                      setSelectedTradeType("both");
                      setSelectedStock(null);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition ${
                      searchAssetClass === "equity"
                        ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Stocks (NSE)
                  </button>
                  <button
                    onClick={() => {
                      setSearchAssetClass("crypto");
                      setSelectedTradeType("all");
                      setSelectedStock(null);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition ${
                      searchAssetClass === "crypto"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Crypto (24/7 USDT)
                  </button>
                </div>

                {process.env.NODE_ENV === "development" && (
                  <button
                    onClick={handleLoadSampleWatchlist}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 border border-slate-700 transition"
                    title="Development-only sample watchlist seeder"
                  >
                    + Load Sample Data (Dev)
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {searchAssetClass === "crypto"
                  ? "Crypto USDT pairs scanned 24/7 across Scalp (5m), Intraday (15m), and Swing (4h) SMC confluences."
                  : "NSE equities scanned candle-by-candle during market hours (09:15–15:30 IST) for Intraday and Delivery setups."}
              </p>
            </div>

            {/* Symbol Autocomplete Search Bar */}
            <div className="relative w-full lg:w-80">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    searchAssetClass === "crypto"
                      ? "Search Crypto pair (e.g. BTC, ETH, SOL)..."
                      : "Search NSE stock (e.g. TCS, IDEA, RELIANCE)..."
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-brand-dark border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-teal transition font-mono"
                />
              </div>

              {/* Autocomplete Dropdown */}
              {(searchResults.length > 0 || searchLoading) && (
                <div className="absolute top-full left-0 right-0 mt-1.5 p-1.5 rounded-xl bg-brand-surfaceElevated border border-slate-700 shadow-2xl z-30 max-h-56 overflow-y-auto space-y-1">
                  {searchLoading && (
                    <div className="p-2 text-xs text-slate-400 text-center">
                      Searching {searchAssetClass === "crypto" ? "CCXT Exchange Markets" : "NSE Scrip Master"}...
                    </div>
                  )}
                  {searchResults.map((item) => (
                    <button
                      key={`${item.symbol}-${item.token}`}
                      onClick={() => {
                        setSelectedStock({
                          ...item,
                          assetClass: item.assetClass || searchAssetClass,
                          exchange: item.exchange || (searchAssetClass === "crypto" ? "BINANCE" : "NSE"),
                        });
                        setSearchQuery(item.symbol);
                        setSearchResults([]);
                      }}
                      className="w-full p-2 text-left rounded-lg hover:bg-slate-800 transition flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">{item.symbol}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {item.exchange || (searchAssetClass === "crypto" ? "BINANCE" : "NSE")}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate max-w-[140px]">{item.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick-pick Crypto Pairs bar when Crypto tab is selected */}
          {searchAssetClass === "crypto" && !selectedStock && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-mono text-slate-400">Popular 24/7 Pairs:</span>
              {QUICK_CRYPTO_PAIRS.map((pair) => (
                <button
                  key={pair.symbol}
                  onClick={() => {
                    setSelectedStock(pair);
                    setSearchQuery(pair.symbol);
                    setSelectedTradeType("all");
                  }}
                  className="px-2.5 py-1 rounded-lg bg-brand-dark hover:bg-slate-800 border border-amber-500/30 text-[11px] font-mono text-amber-300 transition"
                >
                  + {pair.symbol}
                </button>
              ))}
            </div>
          )}

          {/* Add Symbol Setup Bar */}
          {selectedStock && (
            <div className="p-3.5 rounded-xl bg-brand-surfaceElevated border border-brand-teal/40 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-sm text-brand-teal font-mono">{selectedStock.symbol}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {(selectedStock.assetClass || searchAssetClass) === "crypto"
                    ? `CRYPTO · ${selectedStock.exchange || "BINANCE"}`
                    : selectedStock.exchange || "NSE"}
                </span>
                <span className="text-xs text-slate-300">{selectedStock.name}</span>
              </div>

              <div className="flex items-center gap-2">
                {(selectedStock.assetClass || searchAssetClass) === "crypto" ? (
                  <select
                    value={selectedTradeType}
                    onChange={(e) => setSelectedTradeType(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-brand-dark border border-slate-700 text-xs text-white focus:outline-none font-medium"
                  >
                    <option value="all">All (Scalp 5m + Intraday 15m + Swing 4h)</option>
                    <option value="scalp">Scalp Only (5m entry / 1h bias)</option>
                    <option value="intraday">Intraday Only (15m entry / 4h bias)</option>
                    <option value="swing">Swing Only (4h entry / 1d bias)</option>
                  </select>
                ) : (
                  <select
                    value={selectedTradeType}
                    onChange={(e) => setSelectedTradeType(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-brand-dark border border-slate-700 text-xs text-white focus:outline-none font-medium"
                  >
                    <option value="both">Both (Intraday &amp; Delivery)</option>
                    <option value="intraday">Intraday Only (5m entry)</option>
                    <option value="delivery">Delivery Only (Daily entry)</option>
                  </select>
                )}

                <button
                  onClick={handleAddStock}
                  disabled={isAddingStock}
                  className="px-3 py-1.5 rounded-lg bg-brand-teal text-brand-dark text-xs font-bold hover:bg-emerald-400 transition disabled:opacity-50"
                >
                  {isAddingStock ? "Validating & Adding..." : "Add to Scanner"}
                </button>
              </div>
            </div>
          )}

          {addStockError && (
            <div className="text-xs text-rose-400 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
              {addStockError}
            </div>
          )}

          {/* Watchlist Items Grid */}
          {watchlistLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-16 rounded-xl bg-slate-800/40 animate-pulse border border-slate-800" />
              ))}
            </div>
          ) : watchlistError ? (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
              <div className="font-semibold text-sm text-rose-200">Unable to load watchlist items</div>
              <p className="text-xs text-rose-300/80 font-mono max-w-md mx-auto">{watchlistError}</p>
              <button
                type="button"
                onClick={() => setWatchlistRetryKey((k) => k + 1)}
                className="px-4 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-mono transition inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Watchlist
              </button>
            </div>
          ) : filteredWatchlist.length === 0 ? (
            <div className="p-8 rounded-2xl bg-brand-dark/50 border border-brand-border/60 text-center space-y-2">
              <Layers className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="font-semibold text-sm text-slate-300">
                {watchlistSearch ? "No symbols match your search" : "Your Watchlist is Empty"}
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {watchlistSearch
                  ? "Try searching with a different ticker or clear the search input."
                  : "Search for NSE equities or switch to Crypto above and add them to start automated scanning."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Watchlist Search & Sort Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-brand-dark/70 border border-slate-800">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={watchlistSearch}
                    onChange={(e) => setWatchlistSearch(e.target.value)}
                    placeholder="Search in watchlist..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-bg-base border border-slate-700/80 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-blue font-mono"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">Sort by:</span>
                  <select
                    value={watchlistSort}
                    onChange={(e) => setWatchlistSort(e.target.value as any)}
                    className="text-xs font-mono px-2.5 py-1.5 rounded-lg bg-bg-base border border-slate-700/80 text-slate-200 focus:outline-none focus:border-brand-blue"
                  >
                    <option value="alpha">Alphabetical (A-Z)</option>
                    <option value="change">24h Change %</option>
                    <option value="state">Signal State</option>
                  </select>
                </div>
              </div>

              {/* Broker Watchlist Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-bg-card">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-400 font-mono uppercase bg-bg-base/60">
                      <th className="py-3 px-3 w-10 text-center">Pin</th>
                      <th className="py-3 px-3 w-12 text-center">Order</th>
                      <th className="py-3 px-4">Instrument</th>
                      <th className="py-3 px-4 text-right">LTP</th>
                      <th className="py-3 px-4 text-right">24h Chg</th>
                      <th className="py-3 px-4 text-center">24h Trend</th>
                      <th className="py-3 px-4">Latest Signal</th>
                      <th className="py-3 px-4">Strategy</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredWatchlist.map((item, idx) => {
                      const ac = inferAssetClass(item.symbol, item.assetClass);
                      const exch = item.exchange || (ac === "crypto" ? "BINANCE" : "NSE");
                      const lowerTypes = item.tradeTypes.map((t) => t.toLowerCase());
                      const priceInfo = livePrices[item.symbol];
                      const ltpVal = priceInfo?.ltp ?? (ac === "crypto" ? 67420 : 2542.45);
                      const chgVal = priceInfo?.changePct ?? 1.42;
                      const isPositive = chgVal >= 0;
                      const isStarred = !!starredSymbols[item.symbol];

                      // Find latest signal state
                      const activeSig = signals.find((s) => s.symbol === item.symbol);
                      const signalState: string = activeSig
                        ? activeSig.status === "OPEN"
                          ? "CONFIRMED"
                          : String(activeSig.status)
                        : "WATCHING";

                      let currentTypeMode = "both";
                      if (ac === "crypto") {
                        if (lowerTypes.length >= 3) currentTypeMode = "all";
                        else if (lowerTypes.includes("scalp")) currentTypeMode = "scalp";
                        else if (lowerTypes.includes("swing")) currentTypeMode = "swing";
                        else currentTypeMode = "intraday";
                      } else {
                        const isBoth = lowerTypes.includes("intraday") && lowerTypes.includes("delivery");
                        const isIntradayOnly = lowerTypes.length === 1 && lowerTypes.includes("intraday");
                        currentTypeMode = isBoth ? "both" : isIntradayOnly ? "intraday" : "delivery";
                      }

                      return (
                        <tr key={item.symbol} className="hover:bg-slate-900/60 transition-colors">
                          {/* Star Pin */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleStar(item.symbol)}
                              className={`p-1 rounded transition-colors ${
                                isStarred ? "text-amber-400" : "text-slate-600 hover:text-slate-400"
                              }`}
                              title={isStarred ? "Unstar symbol" : "Pin symbol to top"}
                            >
                              <Star className={`w-3.5 h-3.5 ${isStarred ? "fill-amber-400" : ""}`} />
                            </button>
                          </td>

                          {/* Reorder Arrows */}
                          <td className="py-3 px-1 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleMoveItem(idx, "up")}
                                disabled={idx === 0}
                                className="text-slate-600 hover:text-white disabled:opacity-20 transition"
                                title="Move up"
                              >
                                <MoveUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveItem(idx, "down")}
                                disabled={idx === filteredWatchlist.length - 1}
                                className="text-slate-600 hover:text-white disabled:opacity-20 transition"
                                title="Move down"
                              >
                                <MoveDown className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* Instrument (Company Icon + Symbol + Exchange) */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-brand-blue/15 border border-brand-blue/30 flex items-center justify-center font-bold text-xs text-brand-blue shrink-0">
                                {item.symbol.slice(0, 3)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-xs">
                                    {item.symbol.replace(/-EQ$/i, "")}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                    {exch}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 truncate max-w-[140px] font-sans font-normal">
                                  {item.name}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* LTP */}
                          <td className="py-3 px-4 text-right tabular-nums font-bold text-white">
                            {ac === "equity" ? "₹" : "$"}
                            {ltpVal.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>

                          {/* 24h Change % */}
                          <td className="py-3 px-4 text-right tabular-nums">
                            <span
                              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                                isPositive
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-rose-500/15 text-rose-400"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {chgVal.toFixed(2)}%
                            </span>
                          </td>

                          {/* 24h Mini Sparkline (SVG) */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex justify-center">
                              <svg className="w-16 h-4 overflow-visible" viewBox="0 0 70 16">
                                <polyline
                                  fill="none"
                                  stroke={isPositive ? "#16C784" : "#EA3943"}
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  points={
                                    isPositive
                                      ? "2,13 12,11 22,14 32,8 42,10 52,5 62,7 68,2"
                                      : "2,3 12,5 22,4 32,9 42,7 52,12 62,10 68,14"
                                  }
                                />
                              </svg>
                            </div>
                          </td>

                          {/* Latest Signal State */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                signalState === "CONFIRMED"
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : signalState === "FORMING"
                                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                  : "bg-slate-800 text-slate-400 border-slate-700"
                              }`}
                            >
                              {signalState === "CONFIRMED" && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              )}
                              <span>{signalState}</span>
                            </span>
                          </td>

                          {/* Strategy Selector */}
                          <td className="py-3 px-4">
                            {ac === "crypto" ? (
                              <select
                                value={currentTypeMode}
                                disabled={updatingTradeTypeSymbol === item.symbol}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const newTypes =
                                    val === "all" ? ["scalp", "intraday", "swing"] : [val];
                                  handleUpdateTradeTypes(item.symbol, newTypes);
                                }}
                                className="text-[10px] font-mono px-2 py-1 rounded bg-bg-base border border-slate-700 text-amber-300 focus:outline-none"
                              >
                                <option value="all">ALL (Scalp+Intra+Swing)</option>
                                <option value="scalp">SCALP (5m)</option>
                                <option value="intraday">INTRADAY (15m)</option>
                                <option value="swing">SWING (4h)</option>
                              </select>
                            ) : (
                              <select
                                value={currentTypeMode}
                                disabled={updatingTradeTypeSymbol === item.symbol}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const newTypes =
                                    val === "both" ? ["intraday", "delivery"] : [val];
                                  handleUpdateTradeTypes(item.symbol, newTypes);
                                }}
                                className="text-[10px] font-mono px-2 py-1 rounded bg-bg-base border border-slate-700 text-brand-teal focus:outline-none"
                              >
                                <option value="both">BOTH (5m + 1d)</option>
                                <option value="intraday">INTRADAY ONLY</option>
                                <option value="delivery">DELIVERY ONLY</option>
                              </select>
                            )}
                          </td>

                          {/* Actions: Trade Link & Remove */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={`/live?symbol=${encodeURIComponent(item.symbol)}&assetClass=${encodeURIComponent(ac)}&exchange=${encodeURIComponent(exch)}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-blue/15 hover:bg-brand-blue text-brand-blue hover:text-white border border-brand-blue/30 text-[10px] font-bold transition-all shadow-sm"
                                title={`Open ${item.symbol} in Live Analysis`}
                              >
                                <Radio className="w-3 h-3" />
                                <span>Trade</span>
                              </a>

                              {confirmDeleteSymbol === item.symbol ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    onClick={() => handleConfirmRemoveStock(item.symbol)}
                                    className="px-2 py-1 bg-rose-500 text-white rounded text-[10px] font-bold"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteSymbol(null)}
                                    className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-[10px]"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteSymbol(item.symbol)}
                                  className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                  title="Remove from watchlist"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Row 4: Live Signals History Table */}
        <div className="p-6 rounded-2xl bg-brand-surface/90 border border-brand-border space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white font-display">Algorithmic Signals Stream</h3>
              <p className="text-xs text-slate-400">
                Live Firestore subscription with pre-calculated Entry, SL, TP, and confluence audit logs across Stocks &amp; Crypto.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-brand-dark border border-brand-border">
                {["ALL", "OPEN", "TP HIT", "SL HIT"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      statusFilter === st
                        ? "bg-brand-teal text-brand-dark"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-brand-dark border border-brand-border">
                {["ALL", "INTRADAY", "DELIVERY", "SCALP", "SWING"].map((tp) => (
                  <button
                    key={tp}
                    onClick={() => setTypeFilter(tp)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      typeFilter === tp
                        ? "bg-brand-teal text-brand-dark"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tp}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table Container */}
          {signalsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-slate-800/40 animate-pulse border border-slate-800" />
              ))}
            </div>
          ) : signalsError ? (
            <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
              <div className="font-semibold text-sm text-rose-200">Unable to stream signals</div>
              <p className="text-xs text-rose-300/80 font-mono max-w-md mx-auto">{signalsError}</p>
              <button
                type="button"
                onClick={() => setSignalsRetryKey((k) => k + 1)}
                className="px-4 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-mono transition inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Signals Feed
              </button>
            </div>
          ) : filteredSignals.length === 0 ? (
            <div className="p-12 rounded-2xl bg-brand-dark/50 border border-brand-border/60 text-center space-y-2">
              <Radio className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="font-semibold text-sm text-slate-300">
                {statusFilter !== "ALL" || typeFilter !== "ALL" || assetFilter !== "ALL"
                  ? "No signals match the selected filters."
                  : "No signals yet. The scanner is monitoring your watchlist."}
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                When a high-probability SMC setup forms (NSE hours for Stocks, 24/7 for Crypto), the engine will compute Entry, SL, and TP, post it to this table, and dispatch an instant WhatsApp notification.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto space-y-3">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-brand-border text-slate-400 font-mono uppercase text-[10px]">
                    <th className="py-3 px-3">Asset</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Side</th>
                    <th className="py-3 px-3">Entry</th>
                    <th className="py-3 px-3">Stop Loss</th>
                    <th className="py-3 px-3">Take Profit</th>
                    <th className="py-3 px-3">RR</th>
                    <th className="py-3 px-3">Confidence</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Time</th>
                    <th className="py-3 px-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/60">
                  {filteredSignals.map((sig) => {
                    const isExpanded = Boolean(expandedRows[sig.id]);
                    const isBuy = sig.side === "BUY";
                    const ac = inferAssetClass(sig.symbol, sig.assetClass);
                    const exch = sig.exchange || (ac === "crypto" ? "BINANCE" : "NSE");
                    return (
                      <React.Fragment key={sig.id}>
                        <tr className="hover:bg-brand-dark/60 transition group">
                          <td className="py-3.5 px-3 font-bold font-mono text-white">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setChartSignal(sig)}
                                className="text-left hover:text-brand-teal transition underline-offset-2 hover:underline flex items-center gap-1.5"
                                title="Click to view setup candle chart"
                              >
                                <span>{sig.symbol}</span>
                                <BarChart3 className="w-3.5 h-3.5 text-brand-teal opacity-70 group-hover:opacity-100" />
                              </button>
                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                  ac === "crypto"
                                    ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                    : "bg-sky-500/10 text-sky-300 border-sky-500/30"
                                }`}
                              >
                                {ac === "crypto" ? `CRYPTO·${exch}` : exch}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                sig.tradeType === "INTRADAY" || sig.tradeType === "SCALP"
                                  ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                                  : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                              }`}
                            >
                              {sig.tradeType}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 w-fit ${
                                isBuy
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              }`}
                            >
                              {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {sig.side}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-white">
                            {formatAssetPrice(sig.entry, ac)}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-rose-400">
                            {formatAssetPrice(sig.sl, ac)}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-emerald-400">
                            {formatAssetPrice(sig.tp, ac)}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-brand-teal font-semibold">1:{sig.rr.toFixed(2)}</td>
                          <td className="py-3.5 px-3 font-mono text-amber-400">{sig.confidence}%</td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                                sig.status === "OPEN"
                                  ? "bg-sky-500/10 text-sky-400 border-sky-500/30 animate-pulse"
                                  : sig.status === "TP HIT"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              }`}
                            >
                              {sig.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-slate-400 text-[11px] font-mono">
                            {new Date(sig.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setChartSignal(sig)}
                                className="p-1.5 rounded-lg text-brand-teal hover:text-white hover:bg-slate-800 transition border border-brand-teal/20 hover:border-brand-teal/60"
                                title="View Setup Candle Chart"
                              >
                                <BarChart3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => toggleRow(sig.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                title="Toggle confluence audit reasons"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Reasons Row */}
                        {isExpanded && (
                          <tr className="bg-brand-dark/80">
                            <td colSpan={11} className="py-3.5 px-4">
                              <div className="space-y-2">
                                <div className="text-[11px] font-bold text-slate-300 font-mono">
                                  CONFLUENCE AUDIT REASONS ({sig.reasons?.length || 0} FACTORS):
                                </div>
                                <div className="grid sm:grid-cols-2 gap-2 text-xs">
                                  {sig.reasons?.map((r, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-slate-400">
                                      <CheckCircle className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                                      <span>{r}</span>
                                    </div>
                                  ))}
                                </div>
                                {sig.exitPrice && (
                                  <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex gap-4 font-mono">
                                    <span>Exit Price: {formatAssetPrice(sig.exitPrice, ac)}</span>
                                    {sig.closedAt && (
                                      <span>Closed At: {new Date(sig.closedAt).toLocaleString()}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              {/* Load More Signals Button */}
              {signals.length >= signalsLimit && signalsLimit < 200 && (
                <div className="pt-3 text-center">
                  <button
                    onClick={() => setSignalsLimit((prev) => Math.min(prev + 50, 200))}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700 transition"
                  >
                    Load More Signals ({signalsLimit} currently loaded)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* QUANTITATIVE PERFORMANCE & ANALYTICS SECTION (SUPABASE BACKED) */}
        {/* ========================================================================= */}
        <div className="space-y-6 pt-4 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-brand-teal" />
                <h3 className="font-bold text-lg text-white font-mono tracking-tight">
                  Quantitative Performance &amp; Analytics
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Mathematical performance metrics and equity curve computed from resolved trades stored in Supabase.
              </p>
            </div>

            {/* Trade Type Filter */}
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-brand-dark border border-brand-border self-start sm:self-auto">
              {(["ALL", "INTRADAY", "DELIVERY", "SCALP", "SWING"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setEquityFilter(mode)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                    equityFilter === mode
                      ? "bg-brand-teal text-brand-dark"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Metrics & Content */}
          {perfLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-slate-800/40 animate-pulse border border-slate-800" />
              ))}
            </div>
          ) : perfError ? (
            <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
              <div className="font-semibold text-sm text-rose-200">Quantitative Metrics Unavailable</div>
              <p className="text-xs text-rose-300/80 font-mono max-w-md mx-auto">{perfError}</p>
              <button
                type="button"
                onClick={() => {
                  setPerfRetryKey((k) => k + 1);
                  void fetchPerformanceData();
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-mono transition inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Performance Engine
              </button>
            </div>
          ) : !perfMetrics || perfMetrics.total_trades === 0 ? (
            <div className="p-10 rounded-2xl bg-brand-surface border border-slate-800 text-center space-y-3">
              <Activity className="w-9 h-9 text-slate-600 mx-auto" />
              <div className="font-semibold text-sm text-slate-300">
                Performance metrics will appear after your first closed trade.
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                The scanner is monitoring your watchlist. Once a trade setup hits Take Profit or Stop Loss, analytical metrics and equity curves will be populated here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 5 Primary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {/* Win Rate */}
                <div className="p-4 rounded-2xl bg-brand-surface border border-slate-800 hover:border-slate-700 transition space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Win Rate</span>
                    <Target className="w-3.5 h-3.5 text-brand-teal" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">
                    {perfMetrics.win_rate_pct.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    <span className="text-emerald-400">{perfMetrics.win_trades}W</span> /{" "}
                    <span className="text-rose-400">{perfMetrics.loss_trades}L</span> ({perfMetrics.total_trades} closed)
                  </div>
                </div>

                {/* Avg RR */}
                <div className="p-4 rounded-2xl bg-brand-surface border border-slate-800 hover:border-slate-700 transition space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Average RR</span>
                    <TrendingUp className="w-3.5 h-3.5 text-brand-teal" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-brand-teal">
                    1:{perfMetrics.avg_rr.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Target Risk-Reward
                  </div>
                </div>

                {/* Profit Factor */}
                <div className="p-4 rounded-2xl bg-brand-surface border border-slate-800 hover:border-slate-700 transition space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Profit Factor</span>
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div
                    className={`text-2xl font-bold font-mono ${
                      perfMetrics.profit_factor >= 1.5
                        ? "text-emerald-400"
                        : perfMetrics.profit_factor >= 1.0
                        ? "text-sky-400"
                        : "text-rose-400"
                    }`}
                  >
                    {perfMetrics.profit_factor.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Gross Profit / Gross Loss
                  </div>
                </div>

                {/* Expectancy (R) */}
                <div className="p-4 rounded-2xl bg-brand-surface border border-slate-800 hover:border-slate-700 transition space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Expectancy</span>
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div
                    className={`text-2xl font-bold font-mono ${
                      perfMetrics.expectancy_r > 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {perfMetrics.expectancy_r >= 0 ? "+" : ""}
                    {perfMetrics.expectancy_r.toFixed(2)} R
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Edge per executed trade
                  </div>
                </div>

                {/* Max Drawdown (R) */}
                <div className="p-4 rounded-2xl bg-brand-surface border border-slate-800 hover:border-slate-700 transition space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Max Drawdown</span>
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-rose-400">
                    -{perfMetrics.max_drawdown_r.toFixed(2)} R
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Peak-to-trough decline
                  </div>
                </div>
              </div>

              {/* Equity Curve Line Chart */}
              <div className="p-5 rounded-2xl bg-brand-surface border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <LineChart className="w-4 h-4 text-brand-teal" />
                    <span className="font-bold text-sm text-white font-mono">
                      Cumulative R Progression ({equityFilter})
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Net Realized PnL:{" "}
                    <span
                      className={`font-bold ${
                        perfMetrics.net_pnl_r >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {perfMetrics.net_pnl_r >= 0 ? "+" : ""}
                      {perfMetrics.net_pnl_r.toFixed(2)} R
                    </span>
                  </div>
                </div>

                {/* SVG Equity Curve */}
                {renderEquityCurve()}
              </div>

              {/* Per-Asset Performance Table */}
              {perfMetrics.per_stock && perfMetrics.per_stock.length > 0 && (
                <div className="p-5 rounded-2xl bg-brand-surface border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-brand-teal" />
                    <span className="font-bold text-sm text-white font-mono">
                      Per-Symbol Performance Breakdown
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                          <th className="py-2.5 px-3">Symbol</th>
                          <th className="py-2.5 px-3">Trades</th>
                          <th className="py-2.5 px-3">Wins</th>
                          <th className="py-2.5 px-3">Losses</th>
                          <th className="py-2.5 px-3">Win Rate</th>
                          <th className="py-2.5 px-3 text-right">Net R</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {perfMetrics.per_stock.map((stock) => (
                          <tr key={stock.symbol} className="hover:bg-slate-800/30 transition">
                            <td className="py-3 px-3 font-bold text-white">{stock.symbol}</td>
                            <td className="py-3 px-3 text-slate-300">{stock.total}</td>
                            <td className="py-3 px-3 text-emerald-400">{stock.wins}</td>
                            <td className="py-3 px-3 text-rose-400">{stock.losses}</td>
                            <td className="py-3 px-3 text-slate-200">{stock.win_rate_pct.toFixed(1)}%</td>
                            <td
                              className={`py-3 px-3 text-right font-bold ${
                                stock.net_pnl_r >= 0 ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {stock.net_pnl_r >= 0 ? "+" : ""}
                              {stock.net_pnl_r.toFixed(2)} R
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Watchlist Backtest Benchmarks Section */}
          <div className="p-5 rounded-2xl bg-brand-surface border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-teal" />
                <span className="font-bold text-sm text-white font-mono">
                  Watchlist Historical Backtest Benchmarks
                </span>
              </div>
              <span className="text-[11px] text-amber-400/90 font-mono italic">
                Historical backtest, not a guarantee of future results
              </span>
            </div>

            {filteredWatchlist.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono">
                Add stocks or crypto pairs to your Active Watchlist above to view quantitative backtest benchmarks.
              </p>
            ) : backtestsLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-xl bg-slate-800/40 animate-pulse border border-slate-800" />
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredWatchlist.map((item) => {
                  const bt = backtests[item.symbol];
                  const metrics = bt?.metrics;
                  const ac = inferAssetClass(item.symbol, item.assetClass);
                  const exch = item.exchange || (ac === "crypto" ? "BINANCE" : "NSE");
                  return (
                    <div
                      key={item.symbol}
                      className="p-4 rounded-xl bg-brand-dark/70 border border-slate-800 hover:border-slate-700 transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-sm text-white">{item.symbol}</span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                              ac === "crypto"
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                : "bg-sky-500/10 text-sky-300 border-sky-500/30"
                            }`}
                          >
                            {ac === "crypto" ? `CRYPTO·${exch}` : exch}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-teal/10 text-brand-teal border border-brand-teal/20">
                          {bt?.trade_type || "INTRADAY"}
                        </span>
                      </div>
                      {metrics ? (
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                          <div>
                            <span className="text-slate-500 text-[10px] block">BACKTEST WIN%</span>
                            <span className="font-bold text-emerald-400 text-sm">
                              {metrics.win_rate_pct?.toFixed(1) || "--"}%
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">PROFIT FACTOR</span>
                            <span className="font-bold text-brand-teal text-sm">
                              {metrics.profit_factor?.toFixed(2) || "--"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">AVG RR</span>
                            <span className="text-slate-300">1:{metrics.avg_rr?.toFixed(2) || "2.0"}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">SAMPLE TRADES</span>
                            <span className="text-slate-300">{metrics.total_trades || "--"}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 font-mono py-2">
                          Computing backtest metrics...
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section Footer Disclaimer */}
          <div className="text-center py-2">
            <p className="text-[11px] text-slate-500 font-mono">
              Not financial advice. Trading involves risk. Crypto is highly volatile. All setups, backtests, and indicators are provided for analytical education and execution validation.
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SETUP CANDLE CHART MODAL */}
        {/* ========================================================================= */}
        {chartSignal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-brand-surface border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold font-mono text-xl text-white">
                      {chartSignal.symbol}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        inferAssetClass(chartSignal.symbol, chartSignal.assetClass) === "crypto"
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                          : "bg-sky-500/10 text-sky-300 border-sky-500/30"
                      }`}
                    >
                      {inferAssetClass(chartSignal.symbol, chartSignal.assetClass) === "crypto"
                        ? `CRYPTO · ${chartSignal.exchange || "BINANCE"}`
                        : chartSignal.exchange || "NSE"}
                    </span>
                    <span
                      className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded border ${
                        chartSignal.side === "BUY"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {chartSignal.side}
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {chartSignal.tradeType}
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                      Confidence: {chartSignal.confidence}%
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono flex flex-wrap gap-4 pt-1">
                    <span>
                      Entry:{" "}
                      <strong className="text-white">
                        {formatAssetPrice(chartSignal.entry, inferAssetClass(chartSignal.symbol, chartSignal.assetClass))}
                      </strong>
                    </span>
                    <span>
                      Target:{" "}
                      <strong className="text-emerald-400">
                        {formatAssetPrice(chartSignal.tp, inferAssetClass(chartSignal.symbol, chartSignal.assetClass))}
                      </strong>
                    </span>
                    <span>
                      Stop Loss:{" "}
                      <strong className="text-rose-400">
                        {formatAssetPrice(chartSignal.sl, inferAssetClass(chartSignal.symbol, chartSignal.assetClass))}
                      </strong>
                    </span>
                    <span>RR: <strong className="text-brand-teal">1:{chartSignal.rr.toFixed(2)}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Interval selector */}
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-brand-dark border border-slate-800">
                    {(["5m", "15m", "1h", "4h", "1d"] as const).map((intv) => (
                      <button
                        key={intv}
                        onClick={() => setChartInterval(intv)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-mono transition ${
                          chartInterval === intv
                            ? "bg-brand-teal text-brand-dark font-bold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {intv}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setChartSignal(null)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                    title="Close chart"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Chart Body */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Candle Chart with Entry, Stop Loss &amp; Take Profit Levels</span>
                  <span className="text-[11px] text-slate-500">Source: Supabase OHLCV Cache</span>
                </div>
                {renderCandleChart()}
              </div>

              {/* Confluence Factors */}
              {chartSignal.reasons && chartSignal.reasons.length > 0 && (
                <div className="p-3.5 rounded-xl bg-brand-dark/70 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold text-slate-300 font-mono uppercase">
                    Setup Confluence Factors ({chartSignal.reasons.length}):
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    {chartSignal.reasons.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-slate-300">
                        <CheckCircle className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Footer Disclaimer */}
              <div className="pt-2 border-t border-slate-800 text-center">
                <p className="text-[11px] text-slate-500 font-mono">
                  Historical backtest, not a guarantee of future results. Not financial advice. Trading involves risk. Crypto is highly volatile.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
