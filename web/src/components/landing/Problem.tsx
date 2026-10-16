"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { AlertTriangle, CheckCircle, BellOff, Compass, ArrowRight, ShieldAlert } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/motion";

export function Problem() {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReduced = usePrefersReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Smooth transforms based on scroll
  const noiseOpacity = useTransform(scrollYProgress, [0.1, 0.45, 0.7], [1, 0.4, 0.05]);
  const clarityOpacity = useTransform(scrollYProgress, [0.35, 0.65], [0.1, 1]);
  const clarityScale = useTransform(scrollYProgress, [0.35, 0.7], [0.94, 1]);

  return (
    <section
      id="problem"
      ref={containerRef}
      className="relative py-28 lg:py-36 px-4 sm:px-6 lg:px-8 border-t border-brand-border bg-brand-dark overflow-hidden"
    >
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <ShieldAlert className="w-3.5 h-3.5" /> The Retail Dilemma
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display">
            Most traders lose money <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-amber-300 to-rose-300">
              reacting to noise, not structure.
            </span>
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Telegram pump channels, conflicting oscillators, and late entries drain your capital and emotional bandwidth.
          </p>
        </div>

        {/* Visual Transformation: Chaotic Noise VS Algorithmic Clarity */}
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          {/* Left Side: The Chaotic Retail Noise */}
          <motion.div
            style={prefersReduced ? {} : { opacity: noiseOpacity }}
            className="lg:col-span-6 p-6 sm:p-8 rounded-3xl bg-slate-950/60 border border-rose-500/20 relative overflow-hidden backdrop-blur-md"
          >
            <div className="flex items-center justify-between mb-5">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                The Chaos You Face Daily
              </span>
              <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20">
                Emotional Trading
              </span>
            </div>

            {/* Overlapping noisy notifications */}
            <div className="space-y-3 relative">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-rose-500/30 text-xs text-slate-300 space-y-1 shadow-md">
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Telegram Alert #47</span>
                  <span className="text-rose-400 font-mono">10:14 AM</span>
                </div>
                <div className="font-semibold text-rose-300">&ldquo;BUY TCS 3050 CE NOW!! TARGET 3090!! 🚀🚀&rdquo;</div>
                <div className="text-[11px] text-slate-500">No stop loss provided. Chasing green candles.</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/20 text-xs text-slate-300 space-y-1 shadow-md -rotate-1 translate-x-2">
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>WhatsApp Tip Group</span>
                  <span className="text-amber-400 font-mono">11:02 AM</span>
                </div>
                <div className="font-semibold text-amber-300">&ldquo;EXIT ALL LONGS! Market looking weak! Reverse to PUTS!&rdquo;</div>
                <div className="text-[11px] text-slate-500">Whipsawed on minor 1m pullback.</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-700 text-xs text-slate-300 space-y-1 rotate-1 -translate-x-1">
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Overloaded Screen</span>
                  <span className="text-slate-500 font-mono">12:30 PM</span>
                </div>
                <div className="text-slate-300">9 conflicting indicators (RSI overbought, MACD crossing, Bollinger squeeze)...</div>
                <div className="text-[11px] text-rose-400 font-medium">Result: Analysis paralysis & forced bad trades.</div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Risk-to-Reward Ratio</span>
              <span className="text-rose-400 font-mono font-bold">Unfavorable (&lt; 1:1)</span>
            </div>
          </motion.div>

          {/* Right Side: The SignalDesk Clarity */}
          <motion.div
            style={prefersReduced ? {} : { opacity: clarityOpacity, scale: clarityScale }}
            className="lg:col-span-6 p-6 sm:p-8 rounded-3xl bg-brand-surfaceElevated/90 border border-brand-teal/40 relative overflow-hidden shadow-glow-teal backdrop-blur-xl"
          >
            {/* Ambient accent background glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand-teal/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between mb-5">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-brand-teal flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-brand-teal" />
                SignalDesk Algorithmic Precision
              </span>
              <span className="text-[10px] bg-brand-teal/10 text-brand-teal px-2 py-0.5 rounded border border-brand-teal/30 font-semibold">
                Smart Money Concepts
              </span>
            </div>

            {/* Clean, structured signal execution box */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-brand-dark/90 border border-brand-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-white font-mono">TCS-EQ</span>
                    <span className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded font-semibold border border-sky-500/20">
                      INTRADAY BUY
                    </span>
                  </div>
                  <span className="text-xs font-mono text-brand-teal font-bold bg-brand-teal/10 px-2 py-1 rounded">
                    RR 1:2.52
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-brand-surface/80 border border-brand-border text-center">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Entry</div>
                    <div className="text-xs font-mono font-bold text-white">₹3,020.50</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Stop Loss</div>
                    <div className="text-xs font-mono font-bold text-rose-400">₹2,985.00</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Take Profit</div>
                    <div className="text-xs font-mono font-bold text-brand-teal">₹3,110.00</div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 space-y-1">
                  <div className="font-semibold text-slate-200">Algorithmic Confluence Validation:</div>
                  <ul className="space-y-1 text-slate-400">
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
                      1h Change of Character (CHoCH) structural reversal
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
                      5m Bullish Order Block retest in deep discount zone
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
                      Volume expansion 2.4x above 20-bar baseline
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-brand-border flex items-center justify-between text-xs">
              <span className="text-slate-400">Calculated Confidence</span>
              <span className="text-brand-teal font-mono font-bold">84 / 100</span>
            </div>
          </motion.div>
        </div>

        {/* Storybeat summary quote */}
        <div className="p-6 rounded-2xl bg-brand-surface/60 border border-brand-border text-center max-w-3xl mx-auto">
          <p className="text-sm sm:text-base text-slate-300 italic">
            &ldquo;Institutions don&apos;t trade emotions or breakout chases. They wait for liquidity sweeps and order block mitigations. SignalDesk automates that exact discipline for your watchlist.&rdquo;
          </p>
        </div>
      </div>
    </section>
  );
}
