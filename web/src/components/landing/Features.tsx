"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Layers,
  ShieldCheck,
  TrendingUp,
  MessageCircle,
  Cpu,
  Lock,
  BarChart3,
  CheckCircle,
} from "lucide-react";
import { cardHoverVariants } from "@/lib/motion";

export function Features() {
  const features = [
    {
      icon: Layers,
      title: "Multi-Timeframe Pipelines",
      subtitle: "Intraday & Delivery Separation",
      description:
        "Intraday analyzes 1h and 15m for structural bias with 5m execution triggers. Delivery computes Weekly trend bias with Daily order block entries.",
      tag: "Dual Architecture",
    },
    {
      icon: ShieldCheck,
      title: "Strict 1:2 Minimum RR Filter",
      subtitle: "Non-Negotiable Asymmetry",
      description:
        "Every potential setup is vetted by the trade builder. If the distance to the invalidation swing yields a Risk-Reward below 1:2, the setup is rejected outright.",
      tag: "Risk Protocol",
    },
    {
      icon: TrendingUp,
      title: "Real-Time TP/SL Tracker",
      subtitle: "Live Automated Lifecycle",
      description:
        "Open signals are tracked against live candle ticks. The tracker detects TP HIT or SL HIT with conservative conflict resolution (SL first on tie) and logs exit prices.",
      tag: "Zero Lag",
    },
    {
      icon: MessageCircle,
      title: "Instant WhatsApp Cloud Alerts",
      subtitle: "Deterministic Trade Details",
      description:
        "Receive institutional-grade templates directly on WhatsApp containing symbol, side, exact entry, stop loss, take profit, confidence, and confluence reasons.",
      tag: "Meta API",
    },
    {
      icon: Cpu,
      title: "Walk-Forward ML Probability Filter",
      subtitle: "XGBoost 10-Factor Model",
      description:
        "Trained exclusively via walk-forward temporal splits (no random leakage). Only dispatches alerts when ML win probability meets the calibrated threshold.",
      tag: "Machine Learning",
    },
    {
      icon: Lock,
      title: "100% Signal-Only Mode",
      subtitle: "Zero Broker Trading Risk",
      description:
        "SignalDesk is purely an intelligence tool. It never requests broker trading secrets, never places orders, and operates in clean Paper Trading mode.",
      tag: "Zero Exposure",
    },
  ];

  return (
    <section id="features" className="py-28 lg:py-36 px-4 sm:px-6 lg:px-8 border-t border-brand-border bg-brand-surface/40 relative">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-teal/10 border border-brand-teal/20 text-brand-teal">
            <BarChart3 className="w-3.5 h-3.5" /> Institutional Toolset
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display">
            Engineered for quantitative rigor, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-teal via-emerald-300 to-brand-amber">
              not gambling.
            </span>
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Every feature in SignalDesk exists to eliminate emotional errors and enforce strict statistical edge.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                variants={cardHoverVariants}
                initial="rest"
                whileHover="hover"
                className="p-7 rounded-3xl bg-brand-dark/80 border border-brand-border hover:border-brand-teal/40 transition-colors shadow-lg hover:shadow-glow-teal-sm flex flex-col justify-between space-y-5 group relative overflow-hidden"
              >
                {/* Accent corner blur */}
                <div className="absolute top-0 right-0 w-28 h-28 bg-brand-teal/5 rounded-full blur-2xl group-hover:bg-brand-teal/10 transition-colors" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-brand-teal/10 border border-brand-teal/20 flex items-center justify-center text-brand-teal group-hover:scale-105 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold bg-brand-surfaceElevated text-slate-300 px-2.5 py-1 rounded-md border border-brand-border">
                      {feat.tag}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-lg tracking-tight font-display">{feat.title}</h3>
                    <p className="text-xs font-semibold text-brand-teal">{feat.subtitle}</p>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed font-normal">
                    {feat.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-brand-border/60 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-brand-teal" />
                  <span>Rule-based algorithmic standard</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
