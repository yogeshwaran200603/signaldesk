"use client";

import React, { useState } from "react";
import { 
  Laptop, 
  Smartphone, 
  CheckCircle2, 
  Maximize2, 
  ArrowRight,
  Activity,
  Layers,
  Sparkles
} from "lucide-react";
import Link from "next/link";

export function FeatureShowcase() {
  const [deviceTab, setDeviceTab] = useState<"desktop" | "mobile">("desktop");

  return (
    <section className="py-24 lg:py-32 bg-transparent space-y-28 lg:space-y-36">
      <div className="max-w-[1920px] mx-auto px-6 sm:px-12 lg:px-20 xl:px-28 space-y-28 lg:space-y-36">

        {/* BLOCK 1: Cross-Platform Workspace (Desktop & Mobile responsive workspace mockup) */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5 space-y-6">
            <span className="inline-block text-xs font-semibold tracking-wider uppercase text-[#1F5BFF] bg-[#E8F0FE] dark:bg-[#1F5BFF]/15 px-3 py-1 rounded-full">
              CROSS-PLATFORM TERMINAL
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight text-[#111827] dark:text-white font-sans leading-tight">
              Signals where you trade.<br />
              Desktop, tablet or phone.
            </h2>
            <p className="text-[#4B5563] dark:text-slate-300 text-base sm:text-lg leading-relaxed">
              Experience zero compromise across form factors. Monitor live order flow sweeps on your multi-monitor trading desk or track setups anywhere on your phone with low-latency updates.
            </p>

            {/* Feature bullets */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-sm text-[#4B5563] dark:text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-[#1F5BFF] shrink-0" />
                <span>Responsive full-height Lightweight Charts v4 with pinch-zoom</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-[#4B5563] dark:text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-[#1F5BFF] shrink-0" />
                <span>Under 15ms sub-second WebSocket updates without polling</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-[#4B5563] dark:text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-[#1F5BFF] shrink-0" />
                <span>Mobile bottom-sheet trade drawer on touch devices</span>
              </div>
            </div>

            {/* Device switch tabs */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDeviceTab("desktop")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  deviceTab === "desktop"
                    ? "bg-[#1F5BFF] text-white shadow-sm"
                    : "bg-white dark:bg-[#151C2E] text-[#4B5563] dark:text-slate-300 border border-[#E5E7EB] dark:border-white/10 hover:bg-slate-50"
                }`}
              >
                <Laptop className="w-4 h-4" />
                <span>Desktop Workspace</span>
              </button>
              <button
                type="button"
                onClick={() => setDeviceTab("mobile")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  deviceTab === "mobile"
                    ? "bg-[#1F5BFF] text-white shadow-sm"
                    : "bg-white dark:bg-[#151C2E] text-[#4B5563] dark:text-slate-300 border border-[#E5E7EB] dark:border-white/10 hover:bg-slate-50"
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Mobile Pocket Feed</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 flex justify-center">
            {deviceTab === "desktop" ? (
              /* Desktop Mockup: White broker container */
              <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 shadow-xl p-5 transition-all">
                {/* Mock Browser Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB] dark:border-white/10 text-xs text-[#6B7280]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#EA3943]" />
                    <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                    <span className="w-3 h-3 rounded-full bg-[#16C784]" />
                  </div>
                  <div className="px-4 py-1 rounded-md bg-[#F4F5F8] dark:bg-[#151C2E] border border-[#E5E7EB] dark:border-white/10 text-[11px] font-mono text-[#4B5563] dark:text-slate-400">
                    https://signaldesk.app/live?symbol=HDFCBANK
                  </div>
                  <Maximize2 className="w-3.5 h-3.5 text-[#9CA3AF]" />
                </div>

                {/* Mock Workspace Content */}
                <div className="pt-4 grid grid-cols-12 gap-3 h-[290px]">
                  {/* Left mini rail */}
                  <div className="col-span-1 rounded-xl bg-[#F8FAFC] dark:bg-[#151C2E] border border-[#E5E7EB] dark:border-white/10 flex flex-col items-center py-3 space-y-3">
                    <div className="w-7 h-7 rounded-lg bg-[#1F5BFF] text-white flex items-center justify-center text-xs font-bold">SD</div>
                    <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700" />
                  </div>

                  {/* Center chart */}
                  <div className="col-span-8 rounded-xl bg-[#FFFFFF] dark:bg-[#060A14] border border-[#E5E7EB] dark:border-white/10 p-3.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#111827] dark:text-white">HDFCBANK</span>
                        <span className="text-[#16C784] font-mono font-semibold">₹1,642.80</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-[#E8F0FE] text-[#1F5BFF] font-mono text-[10px] font-semibold">5M</span>
                        <span className="px-2 py-0.5 rounded bg-[#F4F5F8] dark:bg-[#151C2E] text-[#4B5563] dark:text-slate-400 font-mono text-[10px]">SMC ACTIVE</span>
                      </div>
                    </div>

                    {/* SVG Chart Line with clamped Bullish OB label */}
                    <div className="h-44 w-full flex items-center">
                      <svg className="w-full h-full" viewBox="0 0 320 110">
                        {/* Shaded OB Zone with background pill */}
                        <rect x="90" y="38" width="80" height="26" fill="#DCFCE7" stroke="#16C784" strokeWidth="1" strokeDasharray="2 2" rx="4" />
                        <text x="96" y="54" fill="#16A34A" fontSize="8" fontWeight="bold">Bullish OB [Sample]</text>

                        <path
                          d="M 10 75 L 40 65 L 70 85 L 100 48 L 130 68 L 160 32 L 190 42 L 220 22 L 250 38 L 290 12"
                          fill="none"
                          stroke="#1F5BFF"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#9CA3AF] font-mono">
                      <span>09:15</span>
                      <span>11:30</span>
                      <span>13:45</span>
                      <span>15:30</span>
                    </div>
                  </div>

                  {/* Right checklist */}
                  <div className="col-span-3 rounded-xl bg-[#F8FAFC] dark:bg-[#151C2E] border border-[#E5E7EB] dark:border-white/10 p-3 flex flex-col justify-between text-[10px]">
                    <div className="space-y-1.5">
                      <div className="font-bold text-[#111827] dark:text-white">8-Point Checklist</div>
                      <div className="flex items-center gap-1 text-[#16C784]">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>Liquidity Sweep</span>
                      </div>
                      <div className="flex items-center gap-1 text-[#16C784]">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>CHoCH Break</span>
                      </div>
                      <div className="flex items-center gap-1 text-[#16C784]">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>Bullish FVG Tap</span>
                      </div>
                      <div className="flex items-center gap-1 text-[#16C784]">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>Volume Delta &gt; 2x</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-[#E5E7EB] dark:border-white/10 text-center font-bold text-[#1F5BFF]">
                      RR 1:2.45
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Mobile Mockup: White phone UI */
              <div className="w-[300px] rounded-[36px] bg-white dark:bg-[#0E1422] border-[4px] border-[#374151] shadow-2xl p-4 flex flex-col space-y-3.5 transition-all">
                {/* Notch */}
                <div className="w-24 h-4 bg-[#111827] rounded-full mx-auto" />
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="font-bold text-[#111827] dark:text-white">SignalDesk Mobile</span>
                  <span className="w-2 h-2 rounded-full bg-[#16C784] animate-pulse" />
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#151C2E] border border-[#E5E7EB] dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#111827] dark:text-white text-xs">NIFTY 50</span>
                    <span className="text-[#16C784] text-xs font-mono font-bold">24,350.20</span>
                  </div>
                  <div className="text-[10px] text-[#6B7280]">Intraday 5M Scalp • Long</div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    <div className="p-1.5 rounded bg-white dark:bg-[#0E1422] text-[#4B5563] dark:text-slate-300 border border-[#E5E7EB]">SL: 24,310</div>
                    <div className="p-1.5 rounded bg-[#DCFCE7] text-[#16A34A] font-bold">TP: 24,440</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#151C2E] border border-[#E5E7EB] dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#111827] dark:text-white text-xs">TCS</span>
                    <span className="text-[#EA3943] text-xs font-mono font-bold">3,980.50</span>
                  </div>
                  <div className="text-[10px] text-[#6B7280]">Bearish FVG Tap • Short</div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    <div className="p-1.5 rounded bg-[#FEE2E2] text-[#DC2626] font-bold">SL: 4,005</div>
                    <div className="p-1.5 rounded bg-[#DCFCE7] text-[#16A34A] font-bold">TP: 3,925</div>
                  </div>
                </div>

                <div className="pt-2 text-center text-[11px] text-[#1F5BFF] font-semibold">
                  Tap card to view verified live chart
                </div>
              </div>
            )}
          </div>
        </div>


        {/* BLOCK 2: Your personal signal feed (alternating: text right, mockups left) */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-7 order-2 lg:order-1 space-y-4">
            {/* Feed Card 1: Pure White Card */}
            <div className="p-6 rounded-xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E8F0FE] text-[#1F5BFF] flex items-center justify-center font-bold text-xs">
                    INFY
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#111827] dark:text-white text-sm">INFOSYS LTD</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#DCFCE7] text-[#16A34A] uppercase">
                        BUY • 5M INTRADAY
                      </span>
                    </div>
                    <span className="text-xs text-[#6B7280]">NSE Equities • 2 mins ago</span>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-sm font-bold text-[#111827] dark:text-white">₹1,885.50</div>
                  <div className="text-[10px] text-[#6B7280]">Candle Closed</div>
                </div>
              </div>

              {/* Confluence tags */}
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                <span className="text-[11px] px-2.5 py-0.5 rounded bg-[#F4F5F8] dark:bg-[#151C2E] text-[#4B5563] dark:text-slate-300 border border-[#E5E7EB] dark:border-white/10">
                  Asia Low Swept
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded bg-[#F4F5F8] dark:bg-[#151C2E] text-[#4B5563] dark:text-slate-300 border border-[#E5E7EB] dark:border-white/10">
                  Bullish Order Block Mitigated
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded bg-[#E8F0FE] text-[#1F5BFF] font-semibold">
                  Sample Setup
                </span>
              </div>

              {/* Trade Levels */}
              <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-[#F4F5F8] dark:bg-[#151C2E] border border-[#E5E7EB] dark:border-white/10">
                  <span className="text-[10px] text-[#6B7280] uppercase block">Entry</span>
                  <span className="text-[#111827] dark:text-white font-bold">1,885.00</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5]/40">
                  <span className="text-[10px] text-[#DC2626] uppercase block font-semibold">Stop Loss</span>
                  <span className="text-[#DC2626] font-bold">1,872.00</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#DCFCE7] border border-[#86EFAC]/40">
                  <span className="text-[10px] text-[#16A34A] uppercase block font-semibold">Target</span>
                  <span className="text-[#16A34A] font-bold">1,914.00</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#E8F0FE] border border-[#1F5BFF]/20">
                  <span className="text-[10px] text-[#1F5BFF] uppercase block font-semibold">Risk:Reward</span>
                  <span className="text-[#1F5BFF] font-bold">1:2.23</span>
                </div>
              </div>
            </div>

            {/* Feed Card 2: Pure White Card */}
            <div className="p-6 rounded-xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F3E8FF] text-[#9333EA] flex items-center justify-center font-bold text-xs">
                    BTC
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#111827] dark:text-white text-sm">BTC/USDT</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEE2E2] text-[#DC2626] uppercase">
                        SELL • 15M SCALP
                      </span>
                    </div>
                    <span className="text-xs text-[#6B7280]">Crypto • 8 mins ago</span>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-sm font-bold text-[#111827] dark:text-white">$67,420.00</div>
                  <div className="text-[10px] text-[#6B7280]">Candle Closed</div>
                </div>
              </div>

              {/* Trade Levels */}
              <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-[#F4F5F8] dark:bg-[#151C2E] border border-[#E5E7EB] dark:border-white/10">
                  <span className="text-[10px] text-[#6B7280] uppercase block">Entry</span>
                  <span className="text-[#111827] dark:text-white font-bold">67,390</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5]/40">
                  <span className="text-[10px] text-[#DC2626] uppercase block font-semibold">Stop Loss</span>
                  <span className="text-[#DC2626] font-bold">67,820</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#DCFCE7] border border-[#86EFAC]/40">
                  <span className="text-[10px] text-[#16A34A] uppercase block font-semibold">Target</span>
                  <span className="text-[#16A34A] font-bold">66,280</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#E8F0FE] border border-[#1F5BFF]/20">
                  <span className="text-[10px] text-[#1F5BFF] uppercase block font-semibold">Risk:Reward</span>
                  <span className="text-[#1F5BFF] font-bold">1:2.58</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 order-1 lg:order-2 space-y-6">
            <span className="inline-block text-xs font-semibold tracking-wider uppercase text-[#1F5BFF] bg-[#E8F0FE] dark:bg-[#1F5BFF]/15 px-3 py-1 rounded-full">
              LIVE STREAM ENGINE
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight text-[#111827] dark:text-white font-sans leading-tight">
              Your personal signal feed.<br />
              Full transparency on every trigger.
            </h2>
            <p className="text-[#4B5563] dark:text-slate-300 text-base sm:text-lg leading-relaxed">
              No black boxes. Every setup card reveals the exact SMC confluence reasons, institutional footprint, and pre-calculated trade parameters with automated one-click chart loading.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-sm text-[#4B5563] dark:text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-[#1F5BFF] shrink-0" />
                <span>Deterministic mathematical rules, zero discretionary bias</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-[#4B5563] dark:text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-[#1F5BFF] shrink-0" />
                <span>Instant &quot;Load on chart&quot; sync to inspect raw order flow</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-[#4B5563] dark:text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-[#1F5BFF] shrink-0" />
                <span>Multi-asset coverage across Indian Equities and Crypto</span>
              </div>
            </div>
          </div>
        </div>


        {/* BLOCK 3: SMC Setup Detection (alternating: text left, mockup right) */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5 space-y-6">
            <span className="inline-block text-xs font-semibold tracking-wider uppercase text-[#1F5BFF] bg-[#E8F0FE] dark:bg-[#1F5BFF]/15 px-3 py-1 rounded-full">
              INSTITUTIONAL SMC ENGINE
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight text-[#111827] dark:text-white font-sans leading-tight">
              Automated SMC detection.<br />
              Order Blocks &amp; FVG mapped live.
            </h2>
            <p className="text-[#4B5563] dark:text-slate-300 text-base sm:text-lg leading-relaxed">
              Stop drawing boxes manually. Our vectorized algorithmic engine identifies institutional footprints in real time: Buy-side / Sell-side liquidity sweeps, Fair Value Gaps (FVG), Change of Character (CHoCH), and Break of Structure (BOS).
            </p>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 shadow-sm">
                <div className="font-bold text-[#111827] dark:text-white text-sm">FVG Imbalances</div>
                <div className="text-xs text-[#6B7280] mt-1">3-bar price discrepancies auto-extended until filled</div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 shadow-sm">
                <div className="font-bold text-[#111827] dark:text-white text-sm">Order Block Zones</div>
                <div className="text-xs text-[#6B7280] mt-1">Displaced origin candles mapped with volume validation</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 shadow-xl p-6 relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB] dark:border-white/10 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#111827] dark:text-white">NIFTY BANK</span>
                  <span className="text-[#6B7280] font-mono">51,240.80</span>
                  <span className="text-xs text-[#1F5BFF] font-mono font-semibold">15M SMC MAP</span>
                </div>
                <span className="px-2.5 py-0.5 rounded bg-[#DCFCE7] text-[#16A34A] text-[11px] font-bold">
                  OB VALIDATED
                </span>
              </div>

              {/* Chart Visual with Annotations: Clean background & clamped labels outside candles */}
              <div className="relative h-64 w-full mt-4 flex items-center justify-center bg-[#F8FAFC] dark:bg-[#060A14] rounded-xl p-2 border border-[#E5E7EB] dark:border-white/10">
                <svg className="w-full h-full" viewBox="0 0 500 200">
                  {/* FVG Highlight Zone with clean pill label outside */}
                  <rect x="180" y="70" width="160" height="40" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1" strokeDasharray="4 2" rx="4" />
                  <rect x="186" y="74" width="130" height="18" fill="#FFFFFF" rx="4" stroke="#0284C7" strokeWidth="0.5" />
                  <text x="192" y="87" fill="#0284C7" fontSize="9" fontWeight="bold">Fair Value Gap (FVG)</text>

                  {/* Order Block Highlight Zone with clean pill label outside */}
                  <rect x="80" y="125" width="220" height="45" fill="#DCFCE7" stroke="#16C784" strokeWidth="1" strokeDasharray="3 3" rx="4" />
                  <rect x="86" y="130" width="180" height="18" fill="#FFFFFF" rx="4" stroke="#16C784" strokeWidth="0.5" />
                  <text x="92" y="143" fill="#16A34A" fontSize="9" fontWeight="bold">Bullish Order Block [50,980 - 51,040]</text>

                  {/* Candlesticks Sequence */}
                  {/* Sweep wick */}
                  <line x1="70" y1="120" x2="70" y2="185" stroke="#EA3943" strokeWidth="2" />
                  <rect x="64" y="130" width="12" height="35" fill="#EA3943" rx="2" />
                  <circle cx="70" cy="185" r="4" fill="#F59E0B" />
                  <text x="35" y="196" fill="#D97706" fontSize="9" fontWeight="bold">Liquidity Purge</text>

                  {/* Strong BOS green candles */}
                  <line x1="110" y1="95" x2="110" y2="155" stroke="#16C784" strokeWidth="2" />
                  <rect x="104" y="105" width="12" height="42" fill="#16C784" rx="2" />

                  <line x1="150" y1="65" x2="150" y2="125" stroke="#16C784" strokeWidth="2" />
                  <rect x="144" y="75" width="12" height="45" fill="#16C784" rx="2" />

                  {/* CHoCH Line */}
                  <line x1="130" y1="75" x2="480" y2="75" stroke="#F59E0B" strokeWidth="1" strokeDasharray="4 4" />
                  <text x="420" y="70" fill="#D97706" fontSize="9" fontWeight="bold">CHoCH Line</text>

                  {/* Retest wick dipping into FVG */}
                  <line x1="220" y1="72" x2="220" y2="120" stroke="#EA3943" strokeWidth="2" />
                  <rect x="214" y="75" width="12" height="25" fill="#EA3943" rx="2" />

                  {/* Blast off candle */}
                  <line x1="260" y1="35" x2="260" y2="95" stroke="#16C784" strokeWidth="2" />
                  <rect x="254" y="45" width="12" height="45" fill="#16C784" rx="2" />

                  <line x1="300" y1="15" x2="300" y2="65" stroke="#16C784" strokeWidth="2" />
                  <rect x="294" y="22" width="12" height="38" fill="#16C784" rx="2" />
                </svg>
              </div>

              <div className="pt-4 border-t border-[#E5E7EB] dark:border-white/10 flex items-center justify-between text-xs text-[#6B7280]">
                <span>Automated Pattern Recognition</span>
                <span className="text-[#1F5BFF] font-semibold">Lightweight Charts v4 Engine</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
