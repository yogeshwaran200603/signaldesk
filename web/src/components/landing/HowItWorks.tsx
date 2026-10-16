"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Search, Sliders, Cpu, MessageSquare, ArrowRight, Zap, Bell, ShieldCheck } from "lucide-react";

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      number: "01",
      title: "Select Your NSE Equities",
      subtitle: "Add liquid stocks to your personal watchlist",
      description:
        "Search from Angel One's full equity master database (TCS, INFY, IDEA, OLAELEC, RELIANCE). The engine tracks symbols without ever asking for broker trading credentials.",
      icon: Search,
    },
    {
      number: "02",
      title: "Choose Timeframe Horizon",
      subtitle: "Intraday, Delivery, or Both pipelines",
      description:
        "Select your strategy preference per stock. Intraday monitors 1h and 15m for structural bias with 5m entries. Delivery scans Weekly bias with Daily entries.",
      icon: Sliders,
    },
    {
      number: "03",
      title: "Multi-Timeframe SMC Engine",
      subtitle: "Continuous confluence & volume scanning",
      description:
        "The quant engine scans candle-by-candle during market hours (09:15-15:30 IST) detecting BOS, CHoCH, Order Block mitigations, Liquidity Sweeps, and Volume Profile POC bounces.",
      icon: Cpu,
    },
    {
      number: "04",
      title: "Instant WhatsApp Alerts",
      subtitle: "Pre-calculated Entry, SL, and TP (Min 1:2 RR)",
      description:
        "When 3+ independent confluences align, the trade builder computes your exact Entry, ATR-buffered Stop Loss, and target Liquidity Pool. Delivered straight to your WhatsApp and live dashboard.",
      icon: MessageSquare,
    },
  ];

  return (
    <section id="how-it-works" className="py-28 lg:py-36 px-4 sm:px-6 lg:px-8 border-t border-brand-border bg-brand-surface/40 relative">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-teal/10 border border-brand-teal/20 text-brand-teal">
            <Zap className="w-3.5 h-3.5" /> End-to-End Workflow
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display">
            How SignalDesk works <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-teal via-brand-sky to-brand-amber">
              in 4 simple steps.
            </span>
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Zero complicated bot configurations. Zero broker account permissions. Pure quantitative clarity.
          </p>
        </div>

        {/* Interactive 2-Column Workflow */}
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Step Selectors */}
          <div className="lg:col-span-6 space-y-4">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = activeStep === idx;
              return (
                <div
                  key={step.number}
                  onClick={() => setActiveStep(idx)}
                  className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer text-left ${
                    isActive
                      ? "bg-brand-surfaceElevated border-brand-teal/50 shadow-glow-teal-sm scale-[1.01]"
                      : "bg-brand-dark/60 border-brand-border hover:border-slate-700/80 hover:bg-brand-dark/90"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isActive
                          ? "bg-brand-teal text-brand-dark font-bold shadow-md shadow-brand-teal/30"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-brand-teal">
                          STEP {step.number}
                        </span>
                        <h3 className="font-bold text-white text-base">{step.title}</h3>
                      </div>
                      <p className="text-xs text-slate-400 font-medium">{step.subtitle}</p>
                      {isActive && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-slate-300 pt-2 leading-relaxed"
                        >
                          {step.description}
                        </motion.p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Morphing Interactive Mockup */}
          <div className="lg:col-span-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-brand-dark border border-brand-teal/30 shadow-2xl shadow-black relative min-h-[460px] flex flex-col justify-center overflow-hidden">
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-teal/10 rounded-full blur-3xl pointer-events-none" />

              <AnimatePresence mode="wait">
                {activeStep === 0 && (
                  <motion.div
                    key="step0"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.35 }}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-brand-border">
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                        Watchlist Selection
                      </span>
                      <span className="text-[11px] bg-brand-teal/10 text-brand-teal px-2 py-0.5 rounded font-mono">
                        NSE Cash
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-brand-surface border border-slate-700/80 flex items-center gap-2">
                      <Search className="w-4 h-4 text-slate-500" />
                      <span className="text-xs text-slate-300 font-mono">Search NSE scrips (e.g. TCS, IDEA, OLAELEC)...</span>
                    </div>

                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-brand-surfaceElevated border border-brand-teal/40 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white text-xs font-mono">TCS-EQ</div>
                          <div className="text-[11px] text-slate-400">Tata Consultancy Services</div>
                        </div>
                        <span className="text-[11px] bg-brand-teal/20 text-brand-teal px-2 py-0.5 rounded font-semibold">
                          Added • Token #11536
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-brand-surface border border-brand-border flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white text-xs font-mono">IDEA-EQ</div>
                          <div className="text-[11px] text-slate-400">Vodafone Idea Limited</div>
                        </div>
                        <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-semibold">
                          Added • Token #14366
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-brand-surface border border-brand-border flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white text-xs font-mono">OLAELEC-EQ</div>
                          <div className="text-[11px] text-slate-400">Ola Electric Mobility</div>
                        </div>
                        <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-semibold">
                          Added • Token #24777
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.35 }}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-brand-border">
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                        Execution Pipeline Config
                      </span>
                      <span className="text-[11px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded font-mono">
                        Multi-Timeframe
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-brand-surface border border-brand-border text-center">
                        <div className="text-xs font-bold text-white mb-1">Intraday</div>
                        <div className="text-[10px] text-slate-400">1h/15m Bias</div>
                        <div className="text-[10px] text-brand-teal font-mono mt-1">5m Entry</div>
                      </div>
                      <div className="p-3 rounded-xl bg-brand-surface border border-brand-border text-center">
                        <div className="text-xs font-bold text-white mb-1">Delivery</div>
                        <div className="text-[10px] text-slate-400">Weekly Bias</div>
                        <div className="text-[10px] text-brand-teal font-mono mt-1">Daily Entry</div>
                      </div>
                      <div className="p-3 rounded-xl bg-brand-teal/10 border border-brand-teal/50 text-center shadow-glow-teal-sm">
                        <div className="text-xs font-bold text-brand-teal mb-1">Both (Active)</div>
                        <div className="text-[10px] text-slate-300">Parallel Dual</div>
                        <div className="text-[10px] text-white font-mono mt-1">Multi-Pipeline</div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-brand-surfaceElevated border border-brand-border space-y-2 text-xs">
                      <div className="text-slate-300 font-semibold flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-brand-teal" />
                        Adaptive Pipeline Isolation
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Intraday scans terminate at 15:30 IST. Delivery positions remain monitored across sessions until Take Profit or Invalidation is hit.
                      </p>
                    </div>
                  </motion.div>
                )}

                {activeStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.35 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-brand-border">
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                        SMC Confluence Engine
                      </span>
                      <span className="text-[11px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono">
                        Confluence 4/4
                      </span>
                    </div>

                    {/* Algorithmic indicators checklist */}
                    <div className="space-y-2.5">
                      <div className="p-3 rounded-xl bg-brand-surface border border-emerald-500/30 flex items-center justify-between text-xs">
                        <span className="text-slate-200">1. Higher-Timeframe Market Structure</span>
                        <span className="text-emerald-400 font-semibold font-mono">1h Bullish CHoCH</span>
                      </div>
                      <div className="p-3 rounded-xl bg-brand-surface border border-emerald-500/30 flex items-center justify-between text-xs">
                        <span className="text-slate-200">2. Institutional Zone Mitigation</span>
                        <span className="text-emerald-400 font-semibold font-mono">5m Order Block (OB)</span>
                      </div>
                      <div className="p-3 rounded-xl bg-brand-surface border border-emerald-500/30 flex items-center justify-between text-xs">
                        <span className="text-slate-200">3. Volume Profile & VWAP Confluence</span>
                        <span className="text-emerald-400 font-semibold font-mono">POC &gt; 2.4x Volume Spike</span>
                      </div>
                      <div className="p-3 rounded-xl bg-brand-surface border border-emerald-500/30 flex items-center justify-between text-xs">
                        <span className="text-slate-200">4. Machine Learning Probability Gate</span>
                        <span className="text-emerald-400 font-semibold font-mono">Win Prob 78% &gt; 60%</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-300 text-[11px] text-center font-medium">
                      Setup Verified • Forwarded to WhatsApp Dispatcher
                    </div>
                  </motion.div>
                )}

                {activeStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.35 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-brand-border">
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                        WhatsApp Cloud Notification
                      </span>
                      <span className="text-[11px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono">
                        Instant Delivery
                      </span>
                    </div>

                    {/* WhatsApp Bubble Mockup */}
                    <div className="p-4 rounded-2xl bg-[#0b241b] border border-emerald-500/30 space-y-2 text-xs text-slate-200 shadow-lg">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                        <Bell className="w-3.5 h-3.5" />
                        <span>SignalDesk Alert: TCS-EQ</span>
                      </div>
                      <div className="space-y-1 font-mono text-[11px]">
                        <div>Type: <strong className="text-white">INTRADAY BUY</strong></div>
                        <div>Entry: <strong className="text-white">₹3,020.50</strong></div>
                        <div>Stop Loss: <strong className="text-rose-400">₹2,985.00</strong></div>
                        <div>Take Profit: <strong className="text-emerald-300">₹3,110.00</strong></div>
                        <div>Risk-to-Reward: <strong className="text-brand-teal">1:2.52</strong></div>
                        <div>Confidence Score: <strong className="text-brand-teal">84/100</strong></div>
                      </div>
                      <div className="pt-2 border-t border-emerald-900/60 text-[10px] text-slate-400 italic">
                        Not financial advice. Trade at your own risk.
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
