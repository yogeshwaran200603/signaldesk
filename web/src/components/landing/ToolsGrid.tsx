"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Calculator, Clock, BookOpen, FileSpreadsheet, ArrowRight, CheckCircle2 } from "lucide-react";

function MarketClock() {
  const [istTime, setIstTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const ist = new Date(utc + 3600000 * 5.5);
      const hours = ist.getHours().toString().padStart(2, "0");
      const minutes = ist.getMinutes().toString().padStart(2, "0");
      const seconds = ist.getSeconds().toString().padStart(2, "0");
      setIstTime(`${hours}:${minutes}:${seconds} IST`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return <span>{istTime || "Loading..."}</span>;
}

export function ToolsGrid() {
  // Mini interactive risk calculator state
  const [capital, setCapital] = useState(100000);
  const [riskPct, setRiskPct] = useState(1);
  const [slPoints, setSlPoints] = useState(25);

  const maxRiskAmount = (capital * riskPct) / 100;
  const positionQty = slPoints > 0 ? Math.floor(maxRiskAmount / slPoints) : 0;

  // Market hours live status (IST)
  const [marketStatus, setMarketStatus] = useState<"OPEN" | "PRE-OPEN" | "CLOSED">("OPEN");

  useEffect(() => {
    const checkMarketStatus = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const ist = new Date(utc + 3600000 * 5.5);
      const day = ist.getDay();
      const isWeekday = day >= 1 && day <= 5;
      const totalMin = ist.getHours() * 60 + ist.getMinutes();

      if (!isWeekday) {
        setMarketStatus("CLOSED");
      } else if (totalMin >= 540 && totalMin < 555) {
        setMarketStatus("PRE-OPEN");
      } else if (totalMin >= 555 && totalMin <= 930) {
        setMarketStatus("OPEN");
      } else {
        setMarketStatus("CLOSED");
      }
    };

    checkMarketStatus();
    const interval = setInterval(checkMarketStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 lg:py-32 bg-transparent relative" id="tools">
      <div className="max-w-[1920px] mx-auto px-6 sm:px-12 lg:px-20 xl:px-28 space-y-16">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="inline-block text-xs font-semibold tracking-wider uppercase text-[#1F5BFF] bg-[#E8F0FE] dark:bg-[#1F5BFF]/15 px-3 py-1 rounded-full">
            TRADER TOOLSET
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#111827] dark:text-white font-sans">
            Essential tools for disciplined traders.
          </h2>
          <p className="text-[#4B5563] dark:text-slate-300 text-base sm:text-lg leading-relaxed">
            Everything you need to execute with professional risk management and stay synchronized with market sessions.
          </p>
        </div>

        {/* 4x1 Tools Grid: White cards, 1px #E5E7EB borders, 12px radius */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Tool 1: Interactive Risk Calculator */}
          <div className="p-7 rounded-xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 flex flex-col justify-between space-y-5 shadow-sm hover:shadow-md transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-[#E8F0FE] text-[#1F5BFF] flex items-center justify-center font-bold">
                  <Calculator className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#F4F5F8] dark:bg-[#151C2E] text-[#6B7280] border border-[#E5E7EB] dark:border-white/10">
                  Interactive
                </span>
              </div>

              <div>
                <h3 className="font-bold text-[#111827] dark:text-white text-base font-sans">Position Risk Calculator</h3>
                <p className="text-xs text-[#6B7280] mt-1">
                  Size positions accurately so no single invalidation harms your account.
                </p>
              </div>

              {/* Calculator inputs */}
              <div className="space-y-2 pt-1 text-xs">
                <div>
                  <div className="flex justify-between text-[#6B7280] text-[11px] mb-1">
                    <span>Account Capital (₹)</span>
                    <span className="text-[#111827] dark:text-white font-mono font-semibold">₹{capital.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="25000"
                    max="1000000"
                    step="25000"
                    value={capital}
                    onChange={(e) => setCapital(Number(e.target.value))}
                    className="w-full accent-[#1F5BFF] h-1.5 bg-[#E5E7EB] dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[#6B7280] text-[11px] mb-1">
                    <span>Risk per trade: {riskPct}%</span>
                    <span className="text-[#EA3943] font-mono font-semibold">₹{maxRiskAmount.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.5"
                    value={riskPct}
                    onChange={(e) => setRiskPct(Number(e.target.value))}
                    className="w-full accent-[#1F5BFF] h-1.5 bg-[#E5E7EB] dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#151C2E] border border-[#E5E7EB] dark:border-white/10 flex items-center justify-between font-mono text-xs">
              <span className="text-[#6B7280]">Position Size:</span>
              <span className="text-[#1F5BFF] font-bold text-sm">{positionQty} shares</span>
            </div>
          </div>


          {/* Tool 2: Market Hours (IST Countdown) */}
          <div className="p-7 rounded-xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 flex flex-col justify-between space-y-5 shadow-sm hover:shadow-md transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <span
                  className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${
                    marketStatus === "OPEN"
                      ? "bg-[#DCFCE7] text-[#16A34A] border-[#86EFAC]/40"
                      : marketStatus === "PRE-OPEN"
                      ? "bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]"
                      : "bg-[#F4F5F8] text-[#6B7280] border-[#E5E7EB]"
                  }`}
                >
                  {marketStatus}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-[#111827] dark:text-white text-base font-sans">Market Hours (IST)</h3>
                <p className="text-xs text-[#6B7280] mt-1">
                  Real-time clock tracking NSE market sessions and global crypto liquidity windows.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-[#F8FAFC] dark:bg-[#151C2E] border border-[#E5E7EB] dark:border-white/10 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#6B7280]">Current Clock:</span>
                  <span className="font-mono text-[#111827] dark:text-white font-bold"><MarketClock /></span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-[#6B7280]">
                  <span>NSE Regular:</span>
                  <span className="font-mono text-[#111827] dark:text-slate-300">09:15 - 15:30 IST</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-[#6B7280]">
                  <span>Crypto Spot/Perp:</span>
                  <span className="font-mono text-[#16A34A] font-semibold">24 / 7 Live</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-[#6B7280] font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#1F5BFF]" />
              <span>NSE Auto-Square-off: 15:15 IST</span>
            </div>
          </div>


          {/* Tool 3: Trade Journal */}
          <div className="p-7 rounded-xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 flex flex-col justify-between space-y-5 shadow-sm hover:shadow-md transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#F4F5F8] dark:bg-[#151C2E] text-[#6B7280] border border-[#E5E7EB] dark:border-white/10">
                  Quant Log
                </span>
              </div>

              <div>
                <h3 className="font-bold text-[#111827] dark:text-white text-base font-sans">Quant Trade Journal</h3>
                <p className="text-xs text-[#6B7280] mt-1">
                  Automatic logging of every signal, R-multiple outcome, and transaction friction.
                </p>
              </div>

              <div className="space-y-2 pt-1 text-xs">
                <div className="flex items-center gap-2 text-[#4B5563] dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-[#16C784] shrink-0" />
                  <span>Gross vs Net R-multiple tracking</span>
                </div>
                <div className="flex items-center gap-2 text-[#4B5563] dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-[#16C784] shrink-0" />
                  <span>Rule adherence compliance rate</span>
                </div>
                <div className="flex items-center gap-2 text-[#4B5563] dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-[#16C784] shrink-0" />
                  <span>Export to CSV &amp; Firestore sync</span>
                </div>
              </div>
            </div>

            <Link href="/portfolio" className="text-xs font-semibold text-[#1F5BFF] hover:underline flex items-center gap-1">
              <span>View Watchlist &amp; Log</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>


          {/* Tool 4: Learning Hub */}
          <div className="p-7 rounded-xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 flex flex-col justify-between space-y-5 shadow-sm hover:shadow-md transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-[#F3E8FF] text-[#9333EA] flex items-center justify-center font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#F4F5F8] dark:bg-[#151C2E] text-[#6B7280] border border-[#E5E7EB] dark:border-white/10">
                  Curriculum
                </span>
              </div>

              <div>
                <h3 className="font-bold text-[#111827] dark:text-white text-base font-sans">SMC Knowledge Hub</h3>
                <p className="text-xs text-[#6B7280] mt-1">
                  Master institutional mechanics: order blocks, fair value gaps, and liquidity sweeps.
                </p>
              </div>

              <div className="space-y-2 pt-1 text-xs">
                <div className="flex items-center gap-2 text-[#4B5563] dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-[#9333EA] shrink-0" />
                  <span>Order Blocks vs Fair Value Gaps</span>
                </div>
                <div className="flex items-center gap-2 text-[#4B5563] dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-[#9333EA] shrink-0" />
                  <span>CHoCH vs BOS Market Structure</span>
                </div>
                <div className="flex items-center gap-2 text-[#4B5563] dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-[#9333EA] shrink-0" />
                  <span>Understanding Walk-Forward ML</span>
                </div>
              </div>
            </div>

            <Link href="/live" className="text-xs font-semibold text-[#1F5BFF] hover:underline flex items-center gap-1">
              <span>Practice in Live Terminal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>

      </div>
    </section>
  );
}
