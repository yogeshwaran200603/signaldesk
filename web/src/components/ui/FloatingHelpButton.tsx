"use client";

import React, { useState } from "react";
import { MessageSquare, HelpCircle, X, ChevronRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function FloatingHelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <aside aria-label="Support and Quick Help" className="fixed bottom-6 right-6 z-50">
      {/* Popover Window */}
      {open && (
        <div className="absolute bottom-16 right-0 w-80 rounded-2xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 shadow-2xl p-5 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB] dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1F5BFF]/10 text-[#1F5BFF] flex items-center justify-center font-bold text-xs">
                SD
              </div>
              <div>
                <div className="text-sm font-bold text-[#111827] dark:text-white">SignalDesk Support</div>
                <div className="text-[11px] text-[#4B5563] dark:text-slate-400">Institutional Quant Desk</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
              aria-label="Close help popup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="py-3 space-y-2 text-xs">
            <Link
              href="/live"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[#F4F5F8] dark:bg-[#151C2E] hover:bg-[#E8F0FE] text-[#111827] dark:text-slate-200 transition group"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#1F5BFF]" />
                <span className="font-medium">How SMC Signals Work</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#1F5BFF] transition" />
            </Link>

            <Link
              href="/performance"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[#F4F5F8] dark:bg-[#151C2E] hover:bg-[#E8F0FE] text-[#111827] dark:text-slate-200 transition group"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#16C784]" />
                <span className="font-medium">Verified Performance & Costs</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#1F5BFF] transition" />
            </Link>
          </div>

          <div className="pt-2 border-t border-[#E5E7EB] dark:border-white/10 text-[11px] text-[#4B5563] dark:text-slate-400 flex items-center justify-between">
            <span>Signals only • No auto-trade</span>
            <span className="font-mono text-[#1F5BFF] font-semibold">Live v2.4</span>
          </div>
        </div>
      )}

      {/* Floating 60px Blue Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-[60px] h-[60px] rounded-full bg-[#1F5BFF] hover:bg-[#1848cc] text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 select-none focus:outline-none focus:ring-4 focus:ring-[#1F5BFF]/30"
        title="Support & Quick Guide"
        aria-label="Support & Quick Guide"
      >
        {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>
    </aside>
  );
}
