"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, ShieldAlert, Lock, Cpu } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-[#E5E7EB] dark:border-white/10 bg-white dark:bg-[#060A14] py-16 px-6 sm:px-12 lg:px-20 xl:px-28 text-xs text-[#4B5563] dark:text-slate-400">
      <div className="max-w-[1920px] mx-auto space-y-12">
        
        {/* Main Footer Links */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          
          {/* Col 1: Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 shadow-sm border border-[#E5E7EB]/80 dark:border-white/10 bg-white dark:bg-[#0E1422]">
                <Image
                  src="/brand/logo.png"
                  alt="SignalDesk Logo"
                  width={32}
                  height={32}
                  className="w-8 h-8 object-contain"
                />
              </div>
              <span className="text-lg font-bold tracking-tight text-[#111827] dark:text-white font-sans">
                Signal<span className="text-[#1F5BFF]">Desk</span>
              </span>
            </div>
            <p className="text-[#4B5563] dark:text-slate-400 text-xs leading-relaxed">
              Institutional Smart Money Concepts (SMC) &amp; volume delta decision-support intelligence for NSE equities and global markets.
            </p>
            <div className="text-[11px] text-[#6B7280] font-mono">
              Engine v2.4 • Walk-Forward Calibrated • Signals Only
            </div>
          </div>

          {/* Col 2: Platform Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#111827] dark:text-slate-200 font-mono">
              Platform
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/live" className="hover:text-[#1F5BFF] transition">
                  Live Trading Terminal
                </Link>
              </li>
              <li>
                <Link href="/portfolio" className="hover:text-[#1F5BFF] transition">
                  Watchlist &amp; Portfolio
                </Link>
              </li>
              <li>
                <Link href="/performance" className="hover:text-[#1F5BFF] transition">
                  Quantitative Track Record
                </Link>
              </li>
              <li>
                <Link href="/feed" className="hover:text-[#1F5BFF] transition">
                  Real-Time Signal Stream
                </Link>
              </li>
              <li>
                <Link href="/review" className="hover:text-[#1F5BFF] transition">
                  Trade Replay &amp; Review
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Risk Architecture */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#111827] dark:text-slate-200 font-mono">
              Risk Architecture
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[#1F5BFF]" />
                <span>Signals only, no auto-trading</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-[#1F5BFF]" />
                <span>Strict 1:2 Minimum Risk-Reward</span>
              </li>
              <li className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-[#1F5BFF]" />
                <span>Walk-Forward XGBoost Gate</span>
              </li>
              <li className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-[#1F5BFF]" />
                <span>Real Transaction Friction Model</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Market Hours */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#111827] dark:text-slate-200 font-mono">
              Trading Hours (IST)
            </h4>
            <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[#6B7280]">Intraday Engine:</span>
                <span className="text-[#1F5BFF] font-mono font-semibold">09:15 - 15:30</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6B7280]">Delivery Scan:</span>
                <span className="text-[#1F5BFF] font-mono font-semibold">Post-Market 16:00</span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-[#E5E7EB] dark:border-white/10 text-[#6B7280]">
                <span>Exchange:</span>
                <span className="text-[#111827] dark:text-white font-mono font-medium">NSE India (Cash/MIS)</span>
              </div>
            </div>
          </div>

        </div>

        {/* Prominent Statutory Risk Disclaimer (SEBI & Regulatory Compliance) */}
        <div className="pt-8 border-t border-[#E5E7EB] dark:border-white/10 space-y-3">
          <div className="p-4 rounded-xl bg-[#FEF3C7]/40 dark:bg-[#151C2E] border border-[#FDE68A] dark:border-amber-500/20 text-[11px] text-[#4B5563] dark:text-slate-300 leading-relaxed space-y-1.5">
            <div className="flex items-center gap-2 text-[#D97706] font-semibold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>STATUTORY RISK &amp; REGULATORY DISCLAIMER (SEBI COMPLIANCE):</span>
            </div>
            <p>
              Trading in equities, intraday derivatives (futures &amp; options), commodities, and cryptocurrencies carries a substantial risk of capital loss and is not suitable for all participants. SignalDesk is an algorithmic decision-support and educational tool providing automated Smart Money Concepts (SMC) pattern recognition.
            </p>
            <p className="text-[#6B7280]">
              SignalDesk does NOT execute trades, does NOT manage funds, and does NOT provide guaranteed returns or personalized investment advice. Backtested and sample metrics do not guarantee future results. Users are solely responsible for their capital and should consult a certified SEBI-registered advisor before committing real capital.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#6B7280] pt-2">
            <div>
              &copy; {new Date().getFullYear()} SignalDesk Technologies. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[#D97706] font-semibold">Sample Mode Active</span>
              <span>•</span>
              <a href="#terms" className="hover:text-[#111827] dark:hover:text-white transition">Terms of Service</a>
              <span>•</span>
              <a href="#privacy" className="hover:text-[#111827] dark:hover:text-white transition">Privacy Policy</a>
              <span>•</span>
              <a href="#security" className="hover:text-[#111827] dark:hover:text-white transition">Security</a>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
