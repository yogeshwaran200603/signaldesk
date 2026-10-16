"use client";

import React from "react";
import Link from "next/link";
import { 
  Search, 
  Command, 
  Radio, 
  Clock, 
  AlertTriangle, 
  RotateCcw, 
  User, 
  TrendingUp, 
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Volume2,
  VolumeX,
  Sparkles
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";
import type { SymbolSearchResult } from "@/components/live/CommandPaletteModal";

export type StrategyModeType = "SCALPING" | "INTRADAY" | "SWING";

interface FeedStatusState {
  status: "LIVE" | "DELAYED" | "CLOSED" | "UNAVAILABLE";
  delaySeconds: number;
  lastTickAt: string | null;
  reason: string | null;
}

interface LiveTopBarProps {
  symbol: string;
  symbolName: string;
  exchange: string;
  ltp: number;
  changePct: number;
  priceFlash: "up" | "down" | null;
  feedStatus: FeedStatusState;
  latencyMs?: number;
  mode: StrategyModeType;
  onModeChange: (m: StrategyModeType) => void;
  onOpenSearch: () => void;
  quickSymbols: SymbolSearchResult[];
  onSelectQuickSymbol: (s: SymbolSearchResult) => void;
  onResetLayout: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  user: any;
  onOpenAuth?: () => void;
  decimals?: number;
  pricePrefix?: string;
}

export function LiveTopBar({
  symbol,
  symbolName,
  exchange,
  ltp,
  changePct,
  priceFlash,
  feedStatus,
  latencyMs = 18,
  mode,
  onModeChange,
  onOpenSearch,
  quickSymbols,
  onSelectQuickSymbol,
  onResetLayout,
  soundEnabled,
  onToggleSound,
  user,
  onOpenAuth,
  decimals = 2,
  pricePrefix = "₹",
}: LiveTopBarProps) {
  const displayTicker = symbol.replace(/-EQ$/i, "");

  return (
    <header className="h-14 bg-white dark:bg-[#0E1422] border-b border-[#E5E7EB] dark:border-white/10 px-3 sm:px-4 flex items-center justify-between gap-3 select-none z-20">
      
      {/* Left: Quick Switcher & Active Symbol Telemetry */}
      <div className="flex items-center gap-3">
        {/* Symbol Search Trigger Button (Ctrl+K) */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#151C2E] hover:bg-slate-100 dark:hover:bg-[#1C253D] border border-[#E5E7EB] dark:border-white/10 text-xs font-mono text-[#4B5563] dark:text-slate-300 hover:text-[#111827] dark:hover:text-white transition-all shadow-sm group"
          title="Search symbols (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5 text-[#1F5BFF] group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-[#111827] dark:text-white">{displayTicker}</span>
          <span className="text-[10px] text-[#6B7280] font-normal hidden sm:inline">
            {exchange}
          </span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white dark:bg-[#0E1422] text-[9px] text-[#6B7280] border border-[#E5E7EB] dark:border-white/10">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>

        {/* Quick Instrument Switcher Pills (NIFTY, BANKNIFTY, RELIANCE, BTC, EURUSD) */}
        <div className="hidden xl:flex items-center gap-1.5">
          {quickSymbols.slice(0, 5).map((qs) => {
            const isCurrent = qs.symbol.toUpperCase() === symbol.toUpperCase();
            return (
              <button
                key={qs.symbol}
                type="button"
                onClick={() => onSelectQuickSymbol(qs)}
                className={`px-2 py-1 rounded-lg text-xs font-mono transition-colors ${
                  isCurrent
                    ? "bg-[#E8F0FE] text-[#1F5BFF] border border-[#1F5BFF]/30 font-semibold"
                    : "text-[#6B7280] dark:text-slate-400 hover:text-[#111827] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent"
                }`}
              >
                {qs.symbol.replace(/-EQ$/i, "")}
              </button>
            );
          })}
        </div>

        {/* Live LTP & Change % */}
        {ltp > 0 && (
          <div
            className={`hidden sm:flex items-baseline gap-2 px-2.5 py-1 rounded-lg font-mono tabular-nums transition-colors duration-300 ${
              priceFlash === "up"
                ? "bg-[#DCFCE7]"
                : priceFlash === "down"
                ? "bg-[#FEE2E2]"
                : ""
            }`}
          >
            <span className="text-sm font-bold text-[#111827] dark:text-white">
              {pricePrefix}
              {ltp.toLocaleString("en-IN", {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
              })}
            </span>
            <span
              className={`text-xs font-semibold flex items-center ${
                changePct >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"
              }`}
            >
              {changePct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* Center: Strategy Mode Tabs (Scalp / Intraday / Swing) */}
      <div className="flex items-center bg-[#F8FAFC] dark:bg-[#151C2E] p-1 rounded-xl border border-[#E5E7EB] dark:border-white/10">
        {(
          [
            { id: "SCALPING", label: "Scalp", sub: "1m/5m" },
            { id: "INTRADAY", label: "Intraday", sub: "5m/15m" },
            { id: "SWING", label: "Swing", sub: "1h/1D" },
          ] as const
        ).map((tab) => {
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onModeChange(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                active
                  ? "bg-brand-blue text-white shadow-glow-blue"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] font-mono hidden md:inline ${active ? "text-white/80" : "text-slate-500"}`}>
                ({tab.sub})
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: Feed Status + Paper Mode Badge + ThemeToggle + User */}
      <div className="flex items-center gap-2">
        {/* Feed Status Badge with Latency */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-bg-base border border-slate-800 text-[11px] font-mono">
          {feedStatus.status === "LIVE" && (
            <>
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-success font-semibold">LIVE</span>
            </>
          )}
          {feedStatus.status === "DELAYED" && (
            <>
              <Clock className="w-3.5 h-3.5 text-warning" />
              <span className="text-warning font-semibold">DELAYED</span>
            </>
          )}
          {feedStatus.status === "CLOSED" && (
            <>
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span className="text-slate-400">CLOSED</span>
            </>
          )}
          {feedStatus.status === "UNAVAILABLE" && (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-danger" />
              <span className="text-danger">OFFLINE</span>
            </>
          )}
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">{latencyMs}ms</span>
        </div>

        {/* Paper Mode Badge */}
        <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-warning/10 border border-warning/40 text-[10px] font-mono font-bold text-warning uppercase">
          <ShieldAlert className="w-3 h-3" />
          <span>Paper Mode</span>
        </div>

        {/* Sound toggle */}
        <Tooltip content={soundEnabled ? "Mute alert chime" : "Enable confirmation chime"} side="bottom">
          <button
            type="button"
            onClick={onToggleSound}
            className={`p-1.5 rounded-xl border text-xs transition-colors ${
              soundEnabled
                ? "bg-brand-blue/15 text-brand-blue border-brand-blue/40"
                : "bg-bg-base text-slate-400 hover:text-white border-slate-800"
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </Tooltip>

        {/* Reset Layout */}
        <Tooltip content="Reset workspace layout" side="bottom">
          <button
            type="button"
            onClick={onResetLayout}
            className="p-1.5 rounded-xl bg-bg-base text-slate-400 hover:text-white border border-slate-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </Tooltip>

        {/* Theme Toggle (Dark / Light) */}
        <ThemeToggle />

        {/* User Avatar or Sign In button */}
        {user ? (
          <div className="flex items-center gap-2 pl-1 border-l border-slate-800">
            <div className="w-7 h-7 rounded-full bg-brand-blue/20 border border-brand-blue/40 flex items-center justify-center text-brand-blue font-bold text-xs uppercase">
              {user.email ? user.email.slice(0, 2) : "U"}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            className="px-3 py-1 rounded-xl bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold text-xs shadow-glow-blue transition-all"
          >
            Sign In
          </button>
        )}
      </div>

    </header>
  );
}
