"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, BarChart2, CheckCircle2, TrendingUp, Sparkles, Activity } from "lucide-react";

interface HeroProps {
  onOpenAuth: (mode: "login" | "signup") => void;
}

export function Hero({ onOpenAuth }: HeroProps) {
  // Live simulated tick price for the mock card (consistent color for both price and change)
  const [tickPrice, setTickPrice] = useState(2542.45);
  const [priceDirection, setPriceDirection] = useState<"up" | "down">("up");

  useEffect(() => {
    const interval = setInterval(() => {
      const delta = (Math.random() - 0.48) * 1.5;
      setTickPrice((prev) => {
        const next = Math.round((prev + delta) * 100) / 100;
        setPriceDirection(delta >= 0 ? "up" : "down");
        return next;
      });
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative pt-[100px] pb-16 lg:pt-[130px] lg:pb-24 overflow-hidden bg-transparent">
      <div className="max-w-[1920px] mx-auto px-6 sm:px-12 lg:px-20 xl:px-28 relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Headline, Subtext, Primary Button, Text Link, Stats Row */}
          <div className="lg:col-span-7 space-y-0 text-left">
            
            {/* Live Status Pill: Clean light styling */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-[#151C2E] border border-[#E5E7EB] dark:border-white/10 text-xs font-medium text-[#4B5563] dark:text-slate-300 shadow-sm mb-6">
              <span className="w-2 h-2 rounded-full bg-[#16C784] animate-pulse" />
              <span className="text-[#1F5BFF] font-semibold">Institutional Smart Money Engine</span>
              <span className="text-[#9CA3AF]">•</span>
              <span>Signals only, no auto-trading</span>
            </div>

            {/* Headline: 3 lines, 76-80px, weight 700, letter-spacing -0.03em, line-height 1.05, color #111827 */}
            <h1 className="text-5xl sm:text-6xl lg:text-[76px] font-bold tracking-[-0.03em] text-[#111827] dark:text-white leading-[1.05] font-sans">
              Signals that<br />
              show their<br />
              work.
            </h1>

            {/* Subtext: 22px, line-height 1.8, color #4B5563, about 520px wide, 40px below headline */}
            <p className="text-[20px] sm:text-[22px] text-[#4B5563] dark:text-slate-300 max-w-[520px] leading-[1.8] font-normal mt-10">
              Institutional SMC setups detected on live tick candles, verified with strict 8-point rules and net-of-cost tracking. Signals only, no auto-trading.
            </p>

            {/* Action Row: Primary Button (180x60px, solid blue #1F5BFF, arrow on SAME line) + Plain text link */}
            <div className="mt-12 flex flex-wrap items-center gap-6">
              <Link
                href="/live"
                className="h-[60px] min-w-[180px] px-8 rounded-xl text-base font-semibold text-white bg-[#1F5BFF] hover:bg-[#1848cc] shadow-sm transition-all duration-200 whitespace-nowrap inline-flex items-center justify-center gap-2 select-none group"
              >
                <span>Open workspace</span>
                <ArrowRight className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>

              <Link
                href="/performance"
                className="text-base font-medium text-[#1F5BFF] hover:text-[#1848cc] underline-offset-4 hover:underline transition-colors inline-flex items-center gap-1.5"
              >
                <span>View track record</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Link>
            </div>

            {/* Stats Row: 3 items side by side, NO cards, NO borders. Number 36-40px w600 #111827. Label 20px #4B5563. 40px gap */}
            <div className="pt-12 mt-12 flex flex-wrap items-start gap-10 sm:gap-14">
              {/* Stat 1 */}
              <div>
                <div className="text-[36px] sm:text-[40px] font-semibold text-[#111827] dark:text-white tracking-tight leading-none font-sans">
                  1,280+
                </div>
                <div className="text-[18px] sm:text-[20px] text-[#4B5563] dark:text-slate-400 mt-1 font-normal">
                  Signals analyzed
                </div>
                <span className="text-xs text-slate-400 block mt-0.5">Sample data</span>
              </div>

              {/* Stat 2 */}
              <div>
                <div className="text-[36px] sm:text-[40px] font-semibold text-[#111827] dark:text-white tracking-tight leading-none font-sans">
                  64.2%
                </div>
                <div className="text-[18px] sm:text-[20px] text-[#4B5563] dark:text-slate-400 mt-1 font-normal">
                  Net win rate
                </div>
                <span className="text-xs text-slate-400 block mt-0.5">Sample data</span>
              </div>

              {/* Stat 3 */}
              <div>
                <div className="text-[36px] sm:text-[40px] font-semibold text-[#111827] dark:text-white tracking-tight leading-none font-sans">
                  1:2.3
                </div>
                <div className="text-[18px] sm:text-[20px] text-[#4B5563] dark:text-slate-400 mt-1 font-normal">
                  Avg risk-reward
                </div>
                <span className="text-xs text-slate-400 block mt-0.5">Sample data</span>
              </div>
            </div>

          </div>

          {/* Right Column: 3D phone mockup on a metallic stand, slightly tilted, with blurred desktop screen behind */}
          <div className="lg:col-span-5 relative flex items-center justify-center pt-8 lg:pt-0">
            
            {/* Blurred Desktop Terminal Screen (Behind the phone) */}
            <div className="absolute -top-6 -left-8 right-4 h-[380px] rounded-2xl bg-white/95 dark:bg-[#0E1422]/90 border border-[#E5E7EB] dark:border-white/10 shadow-2xl p-5 backdrop-blur-md -rotate-2 scale-95 opacity-80 pointer-events-none hidden sm:block">
              {/* Terminal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB] dark:border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#EA3943]/60" />
                  <div className="w-3 h-3 rounded-full bg-[#F59E0B]/60" />
                  <div className="w-3 h-3 rounded-full bg-[#16C784]/60" />
                  <span className="text-xs font-mono text-[#6B7280] ml-2">signaldesk.workspace / nse</span>
                </div>
                <span className="text-[11px] font-mono text-[#1F5BFF] font-semibold bg-[#E8F0FE] px-2 py-0.5 rounded">
                  FEED ONLINE
                </span>
              </div>

              {/* Background Chart Grid */}
              <div className="pt-4 h-56 flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 400 160">
                  <line x1="0" y1="40" x2="400" y2="40" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="0" y1="80" x2="400" y2="80" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="0" y1="120" x2="400" y2="120" stroke="#F1F5F9" strokeWidth="1" />
                  {/* Subtle desktop area line */}
                  <path
                    d="M 10 130 Q 80 110, 140 85 T 240 60 T 320 30 T 390 15"
                    fill="none"
                    stroke="#1F5BFF"
                    strokeWidth="2.5"
                    strokeOpacity="0.4"
                  />
                  {/* Clamped Bullish FVG Zone pill outside candles */}
                  <rect x="180" y="55" width="160" height="24" rx="6" fill="#E8F0FE" stroke="#1F5BFF" strokeWidth="1" strokeDasharray="3 3" />
                  <text x="190" y="71" fill="#1F5BFF" fontSize="10" fontWeight="600" fontFamily="sans-serif">
                    Bullish FVG Zone [Sample]
                  </text>
                </svg>
              </div>
            </div>

            {/* Stand + Phone Container */}
            <div className="relative z-10 flex flex-col items-center">
              
              {/* 3D Realistic Phone Mockup (slightly tilted -2deg, white UI) */}
              <div 
                className="w-[320px] sm:w-[340px] rounded-[42px] bg-[#111827] p-3 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] border-[4px] border-[#374151] transform -rotate-2 hover:rotate-0 transition-transform duration-300 relative"
              >
                {/* Dynamic Island / Speaker Notch */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#111827] rounded-full z-20 flex items-center justify-end px-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700" />
                </div>

                {/* Phone Screen: Pure White UI */}
                <div className="rounded-[32px] bg-white text-[#111827] p-5 pt-8 overflow-hidden flex flex-col justify-between shadow-inner h-[580px]">
                  
                  {/* Top Bar inside Phone */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#6B7280]">
                      <span className="font-semibold text-[#111827]">SignalDesk Mobile</span>
                      <span className="text-[10px] uppercase font-bold text-[#1F5BFF] bg-[#E8F0FE] px-2 py-0.5 rounded">
                        Sample
                      </span>
                    </div>

                    {/* Stock Symbol and LTP */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-bold text-[#111827]">RELIANCE</span>
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#F4F5F8] text-[#4B5563] border border-[#E5E7EB]">
                            NSE • 5M
                          </span>
                        </div>
                        <div className="text-xs text-[#6B7280]">Reliance Industries Ltd</div>
                      </div>

                      {/* Consistent Price and Change Color: Both Green */}
                      <div className="text-right">
                        <div className="text-lg font-bold font-mono text-[#16C784]">
                          ₹{tickPrice.toFixed(2)}
                        </div>
                        <div className="text-xs font-semibold text-[#16C784] flex items-center justify-end gap-0.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>+1.42%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Clean Blue Line Chart Canvas */}
                  <div className="my-2 p-3 rounded-2xl bg-[#F8FAFC] border border-[#E5E7EB] relative">
                    <div className="flex items-center justify-between text-[11px] mb-2">
                      <span className="font-semibold text-[#111827]">Bullish Order Block Sweep</span>
                      <span className="text-[10px] font-bold text-[#16C784] bg-[#DCFCE7] px-1.5 py-0.5 rounded">
                        CONFIRMED
                      </span>
                    </div>

                    <div className="h-36 w-full flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 280 130">
                        <defs>
                          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1F5BFF" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#1F5BFF" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Order Block Shaded Box with clamped label */}
                        <rect x="130" y="65" width="140" height="26" fill="#DCFCE7" stroke="#16C784" strokeWidth="1" strokeDasharray="3 3" rx="4" />
                        <text x="138" y="81" fill="#16A34A" fontSize="9" fontWeight="700" fontFamily="sans-serif">
                          Bullish FVG Zone [Sample]
                        </text>

                        {/* Blue Area Fill under line */}
                        <path
                          d="M 10 110 L 40 95 L 75 105 L 110 70 L 145 85 L 180 50 L 215 60 L 250 25 L 270 20 L 270 120 L 10 120 Z"
                          fill="url(#chartGradient)"
                        />

                        {/* Blue Chart Line */}
                        <path
                          d="M 10 110 L 40 95 L 75 105 L 110 70 L 145 85 L 180 50 L 215 60 L 250 25 L 270 20"
                          fill="none"
                          stroke="#1F5BFF"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Entry / SL / TP Horizontal Markers */}
                        <line x1="130" y1="25" x2="270" y2="25" stroke="#16C784" strokeWidth="1" strokeDasharray="3 2" />
                        <text x="215" y="20" fill="#16C784" fontSize="8" fontWeight="bold">TP: 2568.00</text>

                        <line x1="130" y1="102" x2="270" y2="102" stroke="#EA3943" strokeWidth="1" strokeDasharray="3 2" />
                        <text x="215" y="112" fill="#EA3943" fontSize="8" fontWeight="bold">SL: 2530.00</text>
                      </svg>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#9CA3AF] font-mono mt-1">
                      <span>09:15</span>
                      <span>11:30</span>
                      <span>13:45</span>
                      <span>15:30</span>
                    </div>
                  </div>

                  {/* SignalDesk Parameters Card */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-[#F4F5F8] border border-[#E5E7EB]">
                      <span className="text-[10px] text-[#6B7280] block font-medium">ENTRY</span>
                      <span className="font-mono font-bold text-[#111827] text-xs">2542.00</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#FEE2E2] border border-[#FCA5A5]/40">
                      <span className="text-[10px] text-[#DC2626] block font-medium">STOP LOSS</span>
                      <span className="font-mono font-bold text-[#DC2626] text-xs">2530.00</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#DCFCE7] border border-[#86EFAC]/40">
                      <span className="text-[10px] text-[#16A34A] block font-medium">TARGET</span>
                      <span className="font-mono font-bold text-[#16A34A] text-xs">2568.00</span>
                    </div>
                  </div>

                  {/* 8-Point SMC Checklist Status */}
                  <div className="p-2 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#16C784]" />
                      <span className="text-[#4B5563] font-medium">8-Point SMC Checklist:</span>
                    </div>
                    <span className="font-mono font-bold text-[#16A34A] bg-[#DCFCE7] px-2 py-0.5 rounded text-[10px]">
                      8/8 PASSED
                    </span>
                  </div>

                  {/* Bottom Trade Buttons: Orange SELL button & Blue BUY button (Matching Octa) */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      className="h-[46px] rounded-xl bg-[#FF7A00] hover:bg-[#e06c00] text-white font-bold text-sm flex items-center justify-center gap-1 shadow-sm transition active:scale-95"
                    >
                      <span>SELL</span>
                      <span className="font-mono font-normal text-xs text-orange-100">2541.80</span>
                    </button>
                    <button
                      type="button"
                      className="h-[46px] rounded-xl bg-[#1F5BFF] hover:bg-[#1848cc] text-white font-bold text-sm flex items-center justify-center gap-1 shadow-sm transition active:scale-95"
                    >
                      <span>BUY</span>
                      <span className="font-mono font-normal text-xs text-blue-100">2542.45</span>
                    </button>
                  </div>

                </div>
              </div>

              {/* Realistic Metallic Stand Base (Brushed Aluminum) */}
              <div className="w-32 h-6 bg-gradient-to-b from-[#CBD5E1] via-[#94A3B8] to-[#64748B] rounded-b-xl shadow-lg -mt-1" />
              <div className="w-48 h-3.5 bg-gradient-to-r from-[#94A3B8] via-[#E2E8F0] to-[#94A3B8] rounded-full shadow-xl -mt-1 border border-slate-300" />

            </div>

          </div>

        </div>
      </div>
    </section>
  );
}
