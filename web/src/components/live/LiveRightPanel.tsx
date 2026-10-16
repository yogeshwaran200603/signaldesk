"use client";

import React, { useState } from "react";
import { 
  ChevronRight, 
  ChevronLeft, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check, 
  Calculator, 
  Radio, 
  ExternalLink,
  ShieldAlert,
  Lock,
  ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface ChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  required: boolean;
  status: "PASSED" | "PENDING" | "FAILED";
  detail: string;
}

interface ConfirmedSignalData {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  entry: number;
  sl: number;
  tp: number;
  rr: number;
  mode: string;
  confidence: number;
  mlProbability: number;
  confirmedAt?: string;
  candleTimestamp?: string;
  reasons: string[];
}

interface LiveRightPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  evaluationState: string;
  checklist: ChecklistItem[];
  passedCount: number;
  totalCount: number;
  mlProbability: number | null;
  mlThreshold: number;
  htfBias: "BULLISH" | "BEARISH" | "NEUTRAL";
  confirmedSignal: ConfirmedSignalData | null;
  recentFeedSignals: any[];
  onLoadSignalOnChart: (signal: any) => void;
  decimals?: number;
}

export function LiveRightPanel({
  isCollapsed,
  onToggleCollapse,
  evaluationState,
  checklist,
  passedCount,
  totalCount,
  mlProbability,
  mlThreshold,
  htfBias,
  confirmedSignal,
  recentFeedSignals,
  onLoadSignalOnChart,
  decimals = 2,
}: LiveRightPanelProps) {
  const [activeTab, setActiveTab] = useState<"signal" | "checklist" | "feed">("signal");
  const [copied, setCopied] = useState(false);

  // Position Sizing Calculator state
  const [accountCapital, setAccountCapital] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(1); // 1%

  // Calculate suggested quantity if confirmed signal exists
  let suggestedQty = 0;
  let riskPerShare = 0;
  let maxRiskCapital = (accountCapital * riskPercent) / 100;
  let tp2 = 0;

  if (confirmedSignal && confirmedSignal.entry && confirmedSignal.sl) {
    riskPerShare = Math.abs(confirmedSignal.entry - confirmedSignal.sl);
    if (riskPerShare > 0) {
      suggestedQty = Math.floor(maxRiskCapital / riskPerShare);
    }
    // TP2 calculation (1.5x of target or 1:3 RR)
    const tpDistance = Math.abs(confirmedSignal.tp - confirmedSignal.entry);
    tp2 =
      confirmedSignal.side === "BUY"
        ? confirmedSignal.entry + tpDistance * 1.5
        : confirmedSignal.entry - tpDistance * 1.5;
  }

  // Circular progress math
  const strokeRadius = 26;
  const circumference = 2 * Math.PI * strokeRadius;
  const progressRatio = totalCount > 0 ? passedCount / totalCount : 0;
  const strokeDashoffset = circumference - progressRatio * circumference;

  const handleCopy = () => {
    if (!confirmedSignal) return;
    const text = [
      `SIGNALDESK CONFIRMED SETUP (${confirmedSignal.mode})`,
      `Symbol: ${confirmedSignal.symbol}`,
      `Side: ${confirmedSignal.side}`,
      `Entry: ${confirmedSignal.entry}`,
      `Stop Loss: ${confirmedSignal.sl}`,
      `TP1: ${confirmedSignal.tp}`,
      tp2 ? `TP2: ${tp2.toFixed(decimals)}` : "",
      `RR: 1:${confirmedSignal.rr.toFixed(2)}`,
      `ML Win Prob: ${Math.round((confirmedSignal.mlProbability || 0) * 100)}%`,
      `Confluence: ${(confirmedSignal.reasons || []).join(", ")}`,
      `Suggested Position Size: ${suggestedQty} units (Risk: ₹${maxRiskCapital.toLocaleString()})`,
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isCollapsed) {
    return (
      <div className="hidden lg:flex flex-col items-center justify-start py-4 w-11 bg-bg-card border-l border-slate-800/80 shrink-0">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg bg-bg-raised text-slate-400 hover:text-white border border-slate-800 transition-colors"
          title="Expand Right Panel"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="mt-8 [writing-mode:vertical-lr] text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-pulse" />
          <span>{activeTab.toUpperCase()} • {passedCount}/{totalCount || 8}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full lg:w-80 xl:w-96 bg-bg-card border-l border-slate-800/80 flex flex-col shrink-0 select-none overflow-hidden">
      {/* Panel Header & Tabs */}
      <div className="p-3 border-b border-slate-800/80 flex items-center justify-between gap-2 bg-bg-card">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-bg-base p-1 rounded-xl border border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveTab("signal")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "signal"
                ? "bg-brand-blue text-white shadow-glow-blue"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Signal
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("checklist")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "checklist"
                ? "bg-brand-blue text-white shadow-glow-blue"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>Checklist</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-bg-card text-brand-blue font-mono font-bold">
              {passedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("feed")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "feed"
                ? "bg-brand-blue text-white shadow-glow-blue"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Radio className="w-3 h-3 text-success animate-pulse" />
            <span>Feed</span>
          </button>
        </div>

        {/* Collapse button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-bg-raised transition-colors"
          title="Collapse Panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* ================= TAB 1: SIGNAL ================= */}
        {activeTab === "signal" && (
          <div className="space-y-4">
            {/* Status & Lifecycle badge */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-slate-400">Lifecycle State</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                  evaluationState === "CONFIRMED" || evaluationState === "ACTIVE"
                    ? "bg-success/15 text-success border-success/30"
                    : evaluationState === "FORMING"
                    ? "bg-warning/15 text-warning border-warning/30"
                    : evaluationState === "TP HIT"
                    ? "bg-success/20 text-success border-success/40"
                    : evaluationState === "SL HIT"
                    ? "bg-danger/20 text-danger border-danger/40"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                {evaluationState || "WATCHING"}
              </span>
            </div>

            {confirmedSignal ? (
              <div className="space-y-4">
                {/* Direction and Pair */}
                <div className="p-3.5 rounded-xl bg-bg-base border border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                        confirmedSignal.side === "BUY"
                          ? "bg-success text-slate-950"
                          : "bg-danger text-white"
                      }`}
                    >
                      {confirmedSignal.side}
                    </span>
                    <span className="font-bold text-white text-sm">
                      {confirmedSignal.symbol.replace(/-EQ$/i, "")}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-brand-blue font-bold">
                      RR 1:{confirmedSignal.rr.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Key Levels Grid (Entry, SL, TP1, TP2) */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-bg-base border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">Entry</span>
                    <span className="text-white font-bold text-sm">
                      {confirmedSignal.entry.toFixed(decimals)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-danger/10 border border-danger/20">
                    <span className="text-[10px] text-danger uppercase block">Stop Loss</span>
                    <span className="text-danger font-bold text-sm">
                      {confirmedSignal.sl.toFixed(decimals)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-success/10 border border-success/20">
                    <span className="text-[10px] text-success uppercase block">Target 1 (TP1)</span>
                    <span className="text-success font-bold text-sm">
                      {confirmedSignal.tp.toFixed(decimals)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-brand-blue/10 border border-brand-blue/20">
                    <span className="text-[10px] text-brand-blue uppercase block">Target 2 (TP2)</span>
                    <span className="text-brand-blue font-bold text-sm">
                      {tp2 > 0 ? tp2.toFixed(decimals) : "Runner"}
                    </span>
                  </div>
                </div>

                {/* Quantitative ML Gate and Confluences */}
                <div className="p-3 rounded-xl bg-bg-base border border-slate-800 space-y-2 text-xs font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">ML Win Probability:</span>
                    <span className="text-success font-bold">
                      {Math.round(confirmedSignal.mlProbability * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Structure Bias:</span>
                    <span className="text-slate-200 font-semibold">{htfBias}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300 block mb-1">Confluence Factors:</span>
                    <div className="flex flex-wrap gap-1">
                      {confirmedSignal.reasons.map((r, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-bg-raised text-slate-300 border border-slate-800 text-[10px]">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Position Size Calculator */}
                <div className="p-3.5 rounded-xl bg-bg-base border border-brand-blue/30 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-brand-blue">
                    <span className="flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5" /> Position Sizing Tool
                    </span>
                    <span className="text-[10px] text-slate-400">Based on SL</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Capital (₹)</span>
                      <input
                        type="number"
                        value={accountCapital}
                        onChange={(e) => setAccountCapital(Number(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg bg-bg-raised border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-brand-blue"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Risk %</span>
                      <input
                        type="number"
                        step="0.5"
                        value={riskPercent}
                        onChange={(e) => setRiskPercent(Number(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg bg-bg-raised border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-brand-blue"
                      />
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-bg-card border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Suggested Qty:</span>
                    <span className="text-brand-blue font-bold text-sm">
                      {suggestedQty} shares
                    </span>
                  </div>
                </div>

                {/* Copy Button */}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCopy}
                  className="w-full shadow-glow-blue text-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  <span>{copied ? "Copied Ticket" : "Copy Trade Setup"}</span>
                </Button>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-bg-raised border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <ShieldAlert className="w-6 h-6 text-warning" />
                </div>
                <div className="text-sm font-semibold text-white">No Confirmed Setup</div>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                  SignalDesk locks trade parameters strictly when a candle closes with all 8 confluence rules satisfied.
                </p>
                <div className="p-3 rounded-xl bg-bg-base border border-slate-800 text-left text-xs space-y-1.5 font-mono">
                  <div className="text-slate-400 flex justify-between">
                    <span>Current Phase:</span>
                    <span className="text-warning font-bold">{evaluationState || "WATCHING"}</span>
                  </div>
                  <div className="text-slate-400 flex justify-between">
                    <span>Rules Passed:</span>
                    <span className="text-white font-bold">{passedCount} / {totalCount || 8}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: CHECKLIST ================= */}
        {activeTab === "checklist" && (
          <div className="space-y-4">
            {/* Circular Progress Ring Card */}
            <div className="p-4 rounded-xl bg-bg-base border border-slate-800 flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-white">SMC Checklist Confluence</div>
                <div className="text-[11px] text-slate-400">
                  {passedCount === totalCount
                    ? "All requirements fulfilled!"
                    : `${totalCount - passedCount} more criteria needed for trigger`}
                </div>
                <div className="text-[10px] text-brand-blue font-mono font-semibold pt-1">
                  ML Threshold: {Math.round(mlThreshold * 100)}%
                </div>
              </div>

              {/* SVG Circular Ring */}
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r={strokeRadius}
                    className="stroke-slate-800"
                    strokeWidth="4"
                    fill="transparent"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r={strokeRadius}
                    className="stroke-brand-blue transition-all duration-500 ease-out"
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <span className="absolute font-mono text-xs font-bold text-white">
                  {passedCount}/{totalCount || 8}
                </span>
              </div>
            </div>

            {/* Checklist items */}
            <div className="space-y-2">
              {checklist.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 font-mono">
                  Evaluating live candle confluences...
                </div>
              ) : (
                checklist.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition-all ${
                      item.passed
                        ? "bg-success/10 border-success/30"
                        : "bg-bg-base border-slate-800/80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <span
                          className={`text-xs font-semibold ${
                            item.passed ? "text-success" : "text-slate-300"
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.required && (
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-bg-raised text-slate-400 border border-slate-800">
                            Req
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            item.passed
                              ? "bg-success/20 text-success"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {item.passed ? "PASS" : "WAIT"}
                        </span>
                      </div>
                    </div>

                    {item.detail && (
                      <p className="text-[11px] text-slate-400 mt-1 pl-6 leading-relaxed">
                        {item.detail}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: FEED ================= */}
        {activeTab === "feed" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Live Signal Stream</span>
              <span className="text-[10px] text-slate-500 font-mono">Real-time</span>
            </div>

            {recentFeedSignals.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 font-mono">
                No recent signals on stream.
              </div>
            ) : (
              recentFeedSignals.map((sig, idx) => (
                <div
                  key={sig.id || idx}
                  className="p-3 rounded-xl bg-bg-base border border-slate-800 hover:border-brand-blue/40 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                          sig.side === "BUY"
                            ? "bg-success/15 text-success border border-success/30"
                            : "bg-danger/15 text-danger border border-danger/30"
                        }`}
                      >
                        {sig.side}
                      </span>
                      <span className="font-bold text-white text-xs">
                        {String(sig.symbol || "").replace(/-EQ$/i, "")}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-slate-500">
                      {sig.time || "Active"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-[11px] font-mono text-slate-300">
                    <div>Entry: <span className="text-white font-bold">{sig.entry}</span></div>
                    <div>SL: <span className="text-danger">{sig.sl}</span></div>
                    <div>TP: <span className="text-success">{sig.tp}</span></div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-brand-blue font-mono font-semibold">
                      RR 1:{Number(sig.rr || 2).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onLoadSignalOnChart(sig)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-blue hover:text-sky-300 transition-colors"
                    >
                      <span>Load on chart</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
