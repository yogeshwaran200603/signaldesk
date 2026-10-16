"use client";

import React from "react";
import { CheckSquare, ShieldCheck, DollarSign, Lock, ArrowUpRight } from "lucide-react";

export function BenefitStrip() {
  const benefits = [
    {
      icon: CheckSquare,
      title: "Candle-Close Confirmed",
      subtitle: "Zero Repainting Guarantee",
      description:
        "Signals only confirm after the bar timestamp closes. We eliminate the retail trap of phantom arrows that disappear when price moves.",
      tag: "Deterministic",
    },
    {
      icon: ShieldCheck,
      title: "8-Point SMC Checklist",
      subtitle: "Rule-Based Confluence",
      description:
        "Every setup must pass liquidity sweeps, CHoCH/BOS market structure, Order Block mitigation, FVG imbalance, and volume delta validation.",
      tag: "Confluence",
    },
    {
      icon: DollarSign,
      title: "Cost-Aware Results",
      subtitle: "Real Net-of-Friction Returns",
      description:
        "We simulate real Indian cash market reality: ₹20 brokerage, 0.025% STT, exchange turnover fees, GST, SEBI charges, and conservative slippage.",
      tag: "Quant Cost Model",
    },
    {
      icon: Lock,
      title: "Signals Only, No Auto-Trade",
      subtitle: "Decision Support Platform",
      description:
        "SignalDesk is strictly an algorithmic research and alert intelligence system. We never request your broker credentials or execute real orders.",
      tag: "Risk Managed",
    },
  ];

  return (
    <section className="py-24 lg:py-32 bg-transparent relative overflow-hidden" id="checklist">
      <div className="max-w-[1920px] mx-auto px-6 sm:px-12 lg:px-20 xl:px-28 space-y-16">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="inline-block text-xs font-semibold tracking-wider uppercase text-[#1F5BFF] bg-[#E8F0FE] dark:bg-[#1F5BFF]/15 px-3 py-1 rounded-full">
            BUILT FOR DISCIPLINE
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#111827] dark:text-white font-sans">
            Engineered like an institutional trading desk.
          </h2>
          <p className="text-[#4B5563] dark:text-slate-300 text-base sm:text-lg leading-relaxed">
            Eliminating emotional mistakes with mathematical rigor, transparent cost models, and objective Smart Money Concepts.
          </p>
        </div>

        {/* 4 Benefit Cards Grid: White cards, 1px #E5E7EB border, 12px radius, blue accent only */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div
                key={benefit.title}
                className="p-7 rounded-xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 hover:border-[#1F5BFF]/50 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-[#E8F0FE] dark:bg-[#1F5BFF]/15 text-[#1F5BFF] flex items-center justify-center font-bold">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-[#6B7280] bg-[#F4F5F8] dark:bg-[#151C2E] px-2.5 py-1 rounded-md border border-[#E5E7EB] dark:border-white/10">
                      {benefit.tag}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-[#111827] dark:text-white tracking-tight font-sans">
                      {benefit.title}
                    </h3>
                    <p className="text-xs font-semibold text-[#1F5BFF]">
                      {benefit.subtitle}
                    </p>
                  </div>

                  <p className="text-sm text-[#4B5563] dark:text-slate-400 leading-relaxed font-normal">
                    {benefit.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#E5E7EB] dark:border-white/10 flex items-center justify-between text-xs text-[#6B7280]">
                  <span className="font-medium">Institutional Standard</span>
                  <ArrowUpRight className="w-4 h-4 text-[#1F5BFF]" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
