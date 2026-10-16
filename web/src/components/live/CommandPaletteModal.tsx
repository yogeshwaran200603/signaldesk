"use client";

import React, { useEffect, useRef, useState } from "react";
import { Search, X, TrendingUp, Zap, Clock, ArrowRight } from "lucide-react";

export interface SymbolSearchResult {
  symbol: string;
  token?: string;
  name: string;
  assetClass: "equity" | "crypto" | "forex";
  exchange: string;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  engineUrl: string;
  activeAssetClass: "equity" | "crypto" | "forex";
  watchlist: SymbolSearchResult[];
  onSelectSymbol: (item: SymbolSearchResult) => void;
  onSelectMode: (mode: "SCALPING" | "INTRADAY" | "SWING") => void;
  onSelectTimeframe: (tf: string) => void;
}

const DEFAULT_POPULAR: Record<"equity" | "crypto" | "forex", SymbolSearchResult[]> = {
  equity: [
    { symbol: "RELIANCE-EQ", token: "2885", name: "Reliance Industries", assetClass: "equity", exchange: "NSE" },
    { symbol: "TCS-EQ", token: "11536", name: "Tata Consultancy Services", assetClass: "equity", exchange: "NSE" },
    { symbol: "HDFCBANK-EQ", token: "1333", name: "HDFC Bank", assetClass: "equity", exchange: "NSE" },
    { symbol: "INFY-EQ", token: "1594", name: "Infosys", assetClass: "equity", exchange: "NSE" },
    { symbol: "ICICIBANK-EQ", token: "4963", name: "ICICI Bank", assetClass: "equity", exchange: "NSE" },
    { symbol: "SBIN-EQ", token: "3045", name: "State Bank of India", assetClass: "equity", exchange: "NSE" },
  ],
  crypto: [
    { symbol: "BTC/USDT", token: "BTC/USDT", name: "Bitcoin / Tether USDT", assetClass: "crypto", exchange: "BINANCE" },
    { symbol: "ETH/USDT", token: "ETH/USDT", name: "Ethereum / Tether USDT", assetClass: "crypto", exchange: "BINANCE" },
    { symbol: "SOL/USDT", token: "SOL/USDT", name: "Solana / Tether USDT", assetClass: "crypto", exchange: "BINANCE" },
    { symbol: "BNB/USDT", token: "BNB/USDT", name: "BNB / Tether USDT", assetClass: "crypto", exchange: "BINANCE" },
    { symbol: "XRP/USDT", token: "XRP/USDT", name: "XRP / Tether USDT", assetClass: "crypto", exchange: "BINANCE" },
  ],
  forex: [
    { symbol: "EUR/USD", token: "EUR/USD", name: "Euro / US Dollar", assetClass: "forex", exchange: "FX" },
    { symbol: "GBP/USD", token: "GBP/USD", name: "British Pound / US Dollar", assetClass: "forex", exchange: "FX" },
    { symbol: "USD/JPY", token: "USD/JPY", name: "US Dollar / Japanese Yen", assetClass: "forex", exchange: "FX" },
    { symbol: "USD/INR", token: "USD/INR", name: "US Dollar / Indian Rupee", assetClass: "forex", exchange: "FX" },
  ],
};

export default function CommandPaletteModal({
  isOpen,
  onClose,
  engineUrl,
  activeAssetClass,
  watchlist,
  onSelectSymbol,
  onSelectMode,
  onSelectTimeframe,
}: CommandPaletteModalProps) {
  const [searchTab, setSearchTab] = useState<"equity" | "crypto" | "forex">(activeAssetClass);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSearchTab(activeAssetClass);
  }, [activeAssetClass]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults(DEFAULT_POPULAR[searchTab] || []);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen, searchTab]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(DEFAULT_POPULAR[searchTab] || []);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${engineUrl}/api/symbols/search?q=${encodeURIComponent(trimmed)}&assetClass=${searchTab}&limit=10`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setResults(
              data.map((item: any) => ({
                symbol: item.symbol,
                token: item.token || item.symbol,
                name: item.name || item.symbol,
                assetClass: (item.assetClass || searchTab) as "equity" | "crypto" | "forex",
                exchange:
                  item.exchange ||
                  (searchTab === "crypto" ? "BINANCE" : searchTab === "forex" ? "FX" : "NSE"),
              }))
            );
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fallback to local popular filter if engine offline
      }
      const fallback = (DEFAULT_POPULAR[searchTab] || []).filter(
        (s) =>
          s.symbol.toLowerCase().includes(trimmed.toLowerCase()) ||
          s.name.toLowerCase().includes(trimmed.toLowerCase())
      );
      setResults(fallback);
      setLoading(false);
    }, 180);

    return () => clearTimeout(timer);
  }, [query, searchTab, isOpen, engineUrl]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/75 backdrop-blur-sm transition-opacity duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Symbol and Command Palette"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#0B1220] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden transition-transform duration-150"
      >
        {/* Search Input Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800">
          <Search className="w-4 h-4 text-brand-teal shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search NSE equities, Crypto USDT pairs, or Forex (e.g. RELIANCE, BTC/USDT)..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none font-mono"
            aria-label="Search symbol"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close command palette"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Asset Class Filter Pills */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: "equity", label: "Stocks (NSE)" },
                { id: "crypto", label: "Crypto (24/7)" },
                { id: "forex", label: "Forex (FX)" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSearchTab(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition ${
                  searchTab === tab.id
                    ? "bg-brand-teal text-brand-dark"
                    : "text-slate-400 hover:text-white bg-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
            ESC to close · 1/2/3 for Mode
          </span>
        </div>

        {/* Results & Quick Actions */}
        <div className="max-h-80 overflow-y-auto p-3 space-y-4">
          {/* User Watchlist Quick Picks */}
          {watchlist.length > 0 && !query.trim() && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-2 mb-1.5">
                Your Saved Watchlist
              </div>
              <div className="flex flex-wrap gap-1.5 px-2">
                {watchlist.slice(0, 8).map((w) => (
                  <button
                    key={`${w.assetClass}_${w.symbol}`}
                    type="button"
                    onClick={() => {
                      onSelectSymbol(w);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-brand-teal/20 hover:border-brand-teal/40 border border-slate-700 text-xs font-mono text-slate-200 transition flex items-center gap-1.5"
                  >
                    <TrendingUp className="w-3 h-3 text-brand-teal" />
                    <span>{w.symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Symbol Search Results */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-2 mb-1.5">
              {loading ? "Searching symbols..." : "Matching Instruments"}
            </div>
            <div className="space-y-1">
              {results.map((item) => (
                <button
                  key={`${item.assetClass}_${item.symbol}`}
                  type="button"
                  onClick={() => {
                    onSelectSymbol(item);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800/80 text-left transition group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono font-bold text-white group-hover:text-brand-teal transition">
                      {item.symbol}
                    </span>
                    <span className="text-xs text-slate-400 truncate max-w-[240px]">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {item.exchange}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-brand-teal transition" />
                  </div>
                </button>
              ))}
              {!loading && results.length === 0 && (
                <div className="px-3 py-4 text-center text-xs font-mono text-slate-500">
                  No matching symbols found for &quot;{query}&quot;.
                </div>
              )}
            </div>
          </div>

          {/* Quick Strategy Mode & Timeframe Switchers */}
          <div className="pt-2 border-t border-slate-800/80 grid sm:grid-cols-2 gap-3 px-2">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                <Zap className="w-3 h-3 text-brand-teal" /> Switch Strategy Mode
              </div>
              <div className="flex items-center gap-1.5">
                {(["SCALPING", "INTRADAY", "SWING"] as const).map((m, idx) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onSelectMode(m);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-brand-teal hover:text-brand-dark text-[11px] font-mono text-slate-300 transition border border-slate-700"
                  >
                    [{idx + 1}] {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-brand-teal" /> Quick Timeframe
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {["1m", "5m", "15m", "1h", "4h", "1d"].map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => {
                      onSelectTimeframe(tf);
                      onClose();
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-brand-teal hover:text-brand-dark text-[11px] font-mono text-slate-300 transition border border-slate-700"
                  >
                    {tf === "1d" ? "1D" : tf}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
