"use client";

import React from "react";
import { CheckCircle2, ShieldCheck, TrendingUp, Layers } from "lucide-react";

export function TrustStatsStrip() {
  const stats = [
    {
      value: "1,280+",
      label: "Confirmed Signals",
      sublabel: "Locked strictly on bar close, zero repainting",
      icon: CheckCircle2,
      accent: "text-brand-blue",
      bgAccent: "bg-brand-blue/10 border-brand-blue/20",
    },
    {
      value: "64.2%",
      label: "Net Win Rate",
      sublabel: "Calculated after STT, exchange fees, brokerage & slippage",
      icon: TrendingUp,
      accent: "text-success",
      bgAccent: "bg-success/10 border-success/20",
    },
    {
      value: "3 Markets",
      label: "NSE, Crypto & Forex",
      sublabel: "Real-time tick aggregation across liquid instruments",
      icon: Layers,
      accent: "text-warning",
      bgAccent: "bg-warning/10 border-warning/20",
    },
  ];

  return (
    <div className="border-y border-slate-800/80 bg-bg-card/50 backdrop-blur-md relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 divide-y md:divide-y-0 md:divide-x divide-slate-800/80">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className={`flex items-start gap-4 ${idx > 0 ? "pt-6 md:pt-0 md:pl-12" : ""}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${stat.bgAccent}`}>
                  <Icon className={`w-6 h-6 ${stat.accent}`} />
                </div>
                <div>
                  <div className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight font-sans">
                    {stat.value}
                  </div>
                  <div className="text-sm font-semibold text-slate-200 mt-0.5">
                    {stat.label}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                    {stat.sublabel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
