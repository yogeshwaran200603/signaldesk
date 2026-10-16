"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  RotateCcw, 
  Calendar, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  DollarSign, 
  ArrowRight,
  Filter,
  BarChart2,
  Clock,
  Layers,
  FileText
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LiveLeftRail } from "@/components/live/LiveLeftRail";
import { LiveMobileNav } from "@/components/live/LiveMobileNav";

interface ReplayTrade {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  session: string;
  date: string;
  entryPrice: number;
  exitPrice: number;
  sl: number;
  tp: number;
  grossR: number;
  netR: number;
  costs: {
    brokerage: number;
    stt: number;
    exchangeGst: number;
    slippage: number;
    total: number;
  };
  ruleScore: number; // e.g. 8 (out of 8)
  exitReason: string;
  notes: string;
  confluences: string[];
}

export default function ReviewPage() {
  const sessions = [
    { id: "all", label: "All Sessions" },
    { id: "morning", label: "Morning Opening (09:15 - 11:30)" },
    { id: "midday", label: "Midday Consolidation (11:30 - 13:30)" },
    { id: "afternoon", label: "Afternoon Momentum (13:30 - 15:30)" },
  ];

  const [selectedSession, setSelectedSession] = useState("all");

  const trades: ReplayTrade[] = [
    {
      id: "rep_1",
      symbol: "RELIANCE-EQ",
      side: "BUY",
      session: "morning",
      date: "16 Oct 2026",
      entryPrice: 2542.0,
      exitPrice: 2568.0,
      sl: 2530.0,
      tp: 2568.0,
      grossR: 2.17,
      netR: 2.09,
      costs: {
        brokerage: 20.0,
        stt: 12.8,
        exchangeGst: 4.6,
        slippage: 5.2,
        total: 42.6,
      },
      ruleScore: 8,
      exitReason: "Target 1 (TP) Hit cleanly at 11:05 IST",
      notes: "Clean liquidity sweep below Asia session low. Displacement candle broke structure with 2.4x volume spike. Retest into 5m Bullish FVG filled with zero slippage.",
      confluences: ["Asia Low Swept", "CHoCH Displacement", "FVG Mitigated", "VWAP Reclaim"],
    },
    {
      id: "rep_2",
      symbol: "HDFCBANK-EQ",
      side: "BUY",
      session: "morning",
      date: "16 Oct 2026",
      entryPrice: 1642.5,
      exitPrice: 1632.0,
      sl: 1632.0,
      tp: 1665.0,
      grossR: -1.0,
      netR: -1.04,
      costs: {
        brokerage: 20.0,
        stt: 8.2,
        exchangeGst: 3.4,
        slippage: 3.8,
        total: 35.4,
      },
      ruleScore: 7,
      exitReason: "Stop Loss Hit at 10:22 IST",
      notes: "Setup swept previous day low but broader banking index faced sudden macroeconomic selling pressure. SL resolved conservatively with minimal slippage.",
      confluences: ["PDL Swept", "Bullish OB", "Volume Delta positive"],
    },
    {
      id: "rep_3",
      symbol: "INFY-EQ",
      side: "BUY",
      session: "afternoon",
      date: "15 Oct 2026",
      entryPrice: 1885.0,
      exitPrice: 1914.0,
      sl: 1872.0,
      tp: 1914.0,
      grossR: 2.23,
      netR: 2.14,
      costs: {
        brokerage: 20.0,
        stt: 9.4,
        exchangeGst: 4.1,
        slippage: 4.5,
        total: 38.0,
      },
      ruleScore: 8,
      exitReason: "Target 1 (TP) Reached at 14:40 IST",
      notes: "Textbook order block mitigation after lunchtime lull. FVG gap was completely respected on 15m timeframe.",
      confluences: ["Equal Lows Swept", "15m OB Tap", "RSI Hidden Bullish Divergence"],
    },
    {
      id: "rep_4",
      symbol: "TCS-EQ",
      side: "SELL",
      session: "midday",
      date: "15 Oct 2026",
      entryPrice: 3980.0,
      exitPrice: 3925.0,
      sl: 4005.0,
      tp: 3925.0,
      grossR: 2.2,
      netR: 2.11,
      costs: {
        brokerage: 20.0,
        stt: 19.8,
        exchangeGst: 6.2,
        slippage: 8.0,
        total: 54.0,
      },
      ruleScore: 8,
      exitReason: "Full Target Mitigated at 13:10 IST",
      notes: "Bearish FVG rejection off major weekly resistance array. 1:2.2 RR executed with disciplined invalidation.",
      confluences: ["BSL Purged", "Bearish FVG Rejection", "Delta Negative"],
    },
  ];

  const filteredTrades = trades.filter((t) => {
    if (selectedSession !== "all" && t.session !== selectedSession) return false;
    return true;
  });

  const [selectedTrade, setSelectedTrade] = useState<ReplayTrade>(trades[0]);

  return (
    <div className="min-h-screen bg-bg-base text-slate-100 flex flex-col select-none">
      
      {/* Top Header */}
      <header className="h-14 bg-bg-card border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-blue/15 border border-brand-blue/30 flex items-center justify-center text-brand-blue">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="font-bold text-white text-base tracking-tight font-sans">
              Signal<span className="text-brand-blue">Desk</span>
            </span>
          </Link>
          <span className="text-slate-600">/</span>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <RotateCcw className="w-3.5 h-3.5 text-brand-blue" />
            <span>Session Replay &amp; Review</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/live">
            <Button variant="primary" size="sm" className="shadow-glow-blue text-xs">
              Live Workspace
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Workspace with Left Rail */}
      <div className="flex-1 flex overflow-hidden">
        <LiveLeftRail />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          
          {/* Header Title & Filter */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
                Session Trade Replay
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Step-by-step visual dissection of closed executions, actual costs deducted, and rule-based compliance scores.
              </p>
            </div>

            {/* Session Tabs */}
            <div className="flex items-center bg-bg-card p-1 rounded-xl border border-slate-800 text-xs">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSession(s.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    selectedSession === s.id
                      ? "bg-brand-blue text-white shadow-glow-blue"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2-Column Split: Left Trade Details & Replay Chart | Right Session Trade List */}
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT / CENTER: Trade Replay Chart & Metrics (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Trade Banner */}
              <div className="p-5 rounded-2xl bg-bg-card border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-brand-blue/15 border border-brand-blue/30 flex items-center justify-center font-bold text-sm text-brand-blue">
                      {selectedTrade.symbol.slice(0, 4)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">
                          {selectedTrade.symbol.replace(/-EQ$/i, "")}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            selectedTrade.side === "BUY"
                              ? "bg-success/15 text-success border border-success/30"
                              : "bg-danger/15 text-danger border border-danger/30"
                          }`}
                        >
                          {selectedTrade.side}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {selectedTrade.date}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Exit: <span className="text-slate-200 font-semibold">{selectedTrade.exitReason}</span>
                      </div>
                    </div>
                  </div>

                  {/* Net Outcome Pill */}
                  <div className="text-right">
                    <div
                      className={`text-xl font-bold font-mono ${
                        selectedTrade.netR > 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {selectedTrade.netR > 0 ? `+${selectedTrade.netR.toFixed(2)}` : selectedTrade.netR.toFixed(2)} R
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Net of All Friction</span>
                  </div>
                </div>

                {/* SVG Visual Candlestick Replay Chart */}
                <div className="h-64 w-full p-4 rounded-xl bg-bg-base border border-slate-800/80 relative overflow-hidden flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 500 200">
                    {/* Zones */}
                    <rect x="120" y="90" width="260" height="35" fill="#16C784" fillOpacity="0.1" stroke="#16C784" strokeWidth="0.8" strokeDasharray="3 3" rx="4" />
                    <text x="126" y="112" fill="#16C784" fontSize="9" fontWeight="bold">Bullish Order Block Zone</text>

                    {/* Entry line */}
                    <line x1="120" y1="85" x2="460" y2="85" stroke="#2F6BFF" strokeWidth="1.2" strokeDasharray="4 2" />
                    <text x="390" y="80" fill="#2F6BFF" fontSize="8" fontWeight="bold">ENTRY {selectedTrade.entryPrice}</text>

                    {/* TP Line */}
                    <line x1="120" y1="35" x2="460" y2="35" stroke="#16C784" strokeWidth="1.2" strokeDasharray="4 2" />
                    <text x="390" y="30" fill="#16C784" fontSize="8" fontWeight="bold">TP {selectedTrade.tp}</text>

                    {/* SL Line */}
                    <line x1="120" y1="145" x2="460" y2="145" stroke="#EA3943" strokeWidth="1.2" strokeDasharray="4 2" />
                    <text x="390" y="157" fill="#EA3943" fontSize="8" fontWeight="bold">SL {selectedTrade.sl}</text>

                    {/* Bars */}
                    <line x1="80" y1="70" x2="80" y2="160" stroke="#EA3943" strokeWidth="1.5" />
                    <rect x="75" y="80" width="10" height="50" fill="#EA3943" rx="1.5" />

                    <line x1="140" y1="75" x2="140" y2="120" stroke="#EA3943" strokeWidth="1.5" />
                    <rect x="135" y="82" width="10" height="28" fill="#EA3943" rx="1.5" />

                    {/* Entry Candle (Green arrow) */}
                    <line x1="200" y1="50" x2="200" y2="110" stroke="#16C784" strokeWidth="1.5" />
                    <rect x="195" y="60" width="10" height="35" fill="#16C784" rx="1.5" />
                    <circle cx="200" cy="85" r="4" fill="#2F6BFF" />
                    <text x="180" y="125" fill="#2F6BFF" fontSize="8" fontWeight="bold">Entry Fill</text>

                    {/* Follow through candles */}
                    <line x1="260" y1="40" x2="260" y2="90" stroke="#16C784" strokeWidth="1.5" />
                    <rect x="255" y="48" width="10" height="32" fill="#16C784" rx="1.5" />

                    <line x1="320" y1="25" x2="320" y2="70" stroke="#16C784" strokeWidth="1.5" />
                    <rect x="315" y="32" width="10" height="30" fill="#16C784" rx="1.5" />

                    {/* Exit Fill marker */}
                    <circle cx="320" cy="35" r="4" fill="#16C784" />
                    <text x="330" y="45" fill="#16C784" fontSize="8" fontWeight="bold">Exit Fill</text>
                  </svg>
                </div>

                {/* Costs & Execution Friction Breakdown */}
                <div className="p-4 rounded-xl bg-bg-base border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-warning" />
                      Cost &amp; Friction Deductions
                    </span>
                    <span className="text-warning font-mono">
                      -₹{selectedTrade.costs.total.toFixed(2)} Total Costs
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                    <div className="p-2 rounded-lg bg-bg-card border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">Brokerage</span>
                      <span className="text-white">₹{selectedTrade.costs.brokerage.toFixed(2)}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-bg-card border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">STT</span>
                      <span className="text-white">₹{selectedTrade.costs.stt.toFixed(2)}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-bg-card border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">GST / SEBI</span>
                      <span className="text-white">₹{selectedTrade.costs.exchangeGst.toFixed(2)}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-bg-card border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">Slippage</span>
                      <span className="text-white">₹{selectedTrade.costs.slippage.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Rule Adherence & Strategy Notes */}
                <div className="p-4 rounded-xl bg-bg-base border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-success" />
                      Rule Adherence Score
                    </span>
                    <Badge variant="success" className="text-xs">
                      {selectedTrade.ruleScore}/8 Checklist Followed (100%)
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedTrade.notes}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedTrade.confluences.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-bg-raised text-slate-300 border border-slate-800 text-[10px] font-mono">
                        ✓ {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT SIDEBAR: Session Trade List (4 cols) */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">Session Trade History</span>
                <span className="font-mono">{filteredTrades.length} Trades</span>
              </div>

              {filteredTrades.map((t) => {
                const isSelected = selectedTrade.id === t.id;
                const isProfit = t.netR > 0;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTrade(t)}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-brand-blue/10 border-brand-blue shadow-glow-blue"
                        : "bg-bg-card border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                            t.side === "BUY"
                              ? "bg-success/15 text-success"
                              : "bg-danger/15 text-danger"
                          }`}
                        >
                          {t.side}
                        </span>
                        <span className="font-bold text-white text-xs">
                          {t.symbol.replace(/-EQ$/i, "")}
                        </span>
                      </div>
                      <span
                        className={`font-mono font-bold text-xs ${
                          isProfit ? "text-success" : "text-danger"
                        }`}
                      >
                        {t.netR > 0 ? `+${t.netR.toFixed(2)}` : t.netR.toFixed(2)} R
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-400 font-mono flex items-center justify-between">
                      <span>{t.date}</span>
                      <span>Score: {t.ruleScore}/8</span>
                    </div>
                  </button>
                );
              })}
            </div>

          </div>

        </main>
      </div>

      <LiveMobileNav />
    </div>
  );
}
