"use client";

import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Info, CheckCircle, Scale, AlertOctagon } from "lucide-react";

export function Trust() {
  const stats = [
    {
      value: "58.6%",
      label: "Win Rate",
      sublabel: "Walk-forward backtest split",
      note: "Engine baseline on historical NSE equities",
    },
    {
      value: "1:2.42",
      label: "Average Risk-to-Reward",
      sublabel: "Non-negotiable trade geometry",
      note: "Sub-1:2 setups rejected automatically",
    },
    {
      value: "1.84",
      label: "Profit Factor",
      sublabel: "Net of 0.05% brokerage + slippage",
      note: "Friction modeled candle-by-candle",
    },
    {
      value: "0 Keys",
      label: "Signals Only",
      sublabel: "No automated execution",
      note: "Analytical decision-support tool only. Full control is yours.",
    },
  ];

  return (
    <section id="transparency" className="py-28 lg:py-36 px-4 sm:px-6 lg:px-8 border-t border-brand-border bg-brand-dark relative">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-amber/10 border border-brand-amber/20 text-brand-amber">
            <Scale className="w-3.5 h-3.5" /> Quantitative Transparency
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display">
            Built on statistical edge, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-amber via-brand-teal to-brand-sky">
              not unrealistic promises.
            </span>
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            We never advertise &ldquo;guaranteed profits&rdquo; or &ldquo;100% win rates&rdquo;. In quant trading, long-term expectancy comes from asymmetric risk-reward, disciplined invalidation, and strict risk sizing.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="p-6 rounded-3xl bg-brand-surface/70 border border-brand-border flex flex-col justify-between space-y-3 shadow-md"
            >
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold font-display text-white tracking-tight">
                  {s.value}
                </div>
                <div className="text-xs font-bold text-brand-teal uppercase tracking-wider font-mono mt-1">
                  {s.label}
                </div>
              </div>

              <div className="pt-2 border-t border-brand-border space-y-1 text-xs">
                <div className="text-slate-300 font-medium">{s.sublabel}</div>
                <div className="text-[11px] text-slate-500">{s.note}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Risk Disclaimer Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-brand-surfaceElevated/60 border border-brand-amber/30 max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white font-display">
                Honesty on Market Risk & Performance
              </h3>
              <p className="text-xs text-amber-300 font-medium">
                No strategy is perfect. Past backtested performance is no guarantee of future returns.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Market regimes shift, volatility expands, and unexpected macroeconomic events occur. SignalDesk enforces stop losses on every single trade to protect capital when setups invalidate. Never trade with money you cannot afford to lose. All signals are generated algorithmically for educational and analytical purposes only.
          </p>

          <div className="pt-3 border-t border-brand-border flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>• Walk-Forward Testing (Zero Lookahead Bias)</span>
            <span>• SL First Resolution on Same-Bar Conflicts</span>
            <span>• Net of Standard Brokerage Friction</span>
          </div>
        </div>
      </div>
    </section>
  );
}
