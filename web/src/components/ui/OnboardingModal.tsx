"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { 
  ShieldCheck, 
  CheckCircle2, 
  DollarSign, 
  Compass, 
  ArrowRight, 
  X, 
  Layers, 
  Radio, 
  TrendingUp 
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface OnboardingModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function OnboardingModal({ forceOpen = false, onClose }: OnboardingModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<"NSE" | "CRYPTO" | "FOREX">("NSE");

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }
    // Only auto-trigger onboarding popup on landing page
    if (pathname !== "/") return;

    const hasSeen = localStorage.getItem("sd_onboarding_completed");
    if (!hasSeen) {
      const timer = setTimeout(() => setIsOpen(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [forceOpen, pathname]);

  const handleFinish = () => {
    if (dontShowAgain) {
      localStorage.setItem("sd_onboarding_completed", "true");
    }
    setIsOpen(false);
    if (onClose) onClose();

    const sym = selectedMarket === "NSE" ? "RELIANCE-EQ" : selectedMarket === "CRYPTO" ? "BTC/USDT" : "EUR/USD";
    const ac = selectedMarket === "NSE" ? "equity" : selectedMarket === "CRYPTO" ? "crypto" : "forex";
    router.push(`/live?symbol=${sym}&assetClass=${ac}`);
  };

  const handleDismiss = () => {
    if (dontShowAgain) {
      localStorage.setItem("sd_onboarding_completed", "true");
    }
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#0E1422] border border-[#E5E7EB] dark:border-white/10 shadow-2xl p-6 md:p-8 space-y-6">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-xl text-[#4B5563] hover:text-[#111827] dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Stepper Progress */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB] dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1F5BFF]" />
            <span className="text-xs font-mono uppercase tracking-wider text-[#4B5563] dark:text-slate-400 font-semibold">
              SignalDesk Walkthrough • Step {step} of 4
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? "w-6 bg-[#1F5BFF]"
                    : s < step
                    ? "w-2.5 bg-[#16C784]"
                    : "w-2.5 bg-slate-200 dark:bg-slate-800"
                }`}
              />
            ))}
          </div>
        </div>

        {/* STEP 1: Signals, Not Execution */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-[#1F5BFF]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#111827] dark:text-white font-sans">
                Signals only, no auto-trading.
              </h2>
              <p className="text-sm text-[#4B5563] dark:text-slate-300 mt-2 leading-relaxed">
                SignalDesk is an analytical decision-support tool. We never request your broker API keys or trade execution passwords. All signals are generated algorithmically for your review, leaving complete discretionary control in your hands.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#060A14] border border-[#E5E7EB] dark:border-white/10 text-xs font-mono text-[#4B5563] dark:text-slate-400 space-y-1">
              <div className="text-[#16C784] flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Capital Control
              </div>
              <div>No auto-orders, no API key access. Discretionary execution only.</div>
            </div>
          </div>
        )}

        {/* STEP 2: The 8-Point SMC Filter */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-center justify-center text-[#16C784]">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#111827] dark:text-white font-sans">
                The 8-point SMC quantitative checklist.
              </h2>
              <p className="text-sm text-[#4B5563] dark:text-slate-300 mt-2 leading-relaxed">
                Retail setups fail because they trigger on premature wicks. SignalDesk requires liquidity sweeps, CHoCH/BOS market structure, Order Block mitigation, and FVG retests. Setups only lock on candle close.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#060A14] border border-[#E5E7EB] dark:border-white/10 text-[#111827] dark:text-slate-300">
                ✓ Liquidity Purge (BSL/SSL)
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#060A14] border border-[#E5E7EB] dark:border-white/10 text-[#111827] dark:text-slate-300">
                ✓ CHoCH Structure Shift
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#060A14] border border-[#E5E7EB] dark:border-white/10 text-[#111827] dark:text-slate-300">
                ✓ Order Block Retest
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#060A14] border border-[#E5E7EB] dark:border-white/10 text-[#111827] dark:text-slate-300">
                ✓ FVG Imbalance Fill
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Cost-Aware Edge */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-center text-amber-500">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#111827] dark:text-white font-sans">
                True expectancy net of Indian market friction.
              </h2>
              <p className="text-sm text-[#4B5563] dark:text-slate-300 mt-2 leading-relaxed">
                Most platforms display fake gross win rates. SignalDesk deducts ₹20 brokerage, 0.025% STT, exchange transaction charges, GST, SEBI fees, and slippage before computing any R-multiple profit.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#060A14] border border-[#E5E7EB] dark:border-white/10 flex items-center justify-between font-mono text-xs">
              <span className="text-[#4B5563] dark:text-slate-400">Net Win Rate Tracked:</span>
              <span className="text-[#16C784] font-bold text-sm">64.2% Net of Costs</span>
            </div>
          </div>
        )}

        {/* STEP 4: Pick Your First Market */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#111827] dark:text-white font-sans">
                Select your primary market to start.
              </h2>
              <p className="text-sm text-[#4B5563] dark:text-slate-300 mt-2 leading-relaxed">
                Choose the instrument category you trade most frequently. You can switch between all 3 seamlessly in the terminal at any time.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {[
                { id: "NSE", label: "NSE Stocks", sub: "RELIANCE, TCS, HDFC" },
                { id: "CRYPTO", label: "Crypto 24/7", sub: "BTC, ETH, SOL" },
                { id: "FOREX", label: "Forex FX", sub: "EUR/USD, GBP/USD" },
              ].map((m) => {
                const isSelected = selectedMarket === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMarket(m.id as any)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/40 border-[#1F5BFF] text-[#1F5BFF] dark:text-white"
                        : "bg-slate-50 dark:bg-[#060A14] border-[#E5E7EB] dark:border-white/10 text-[#4B5563] dark:text-slate-400 hover:text-[#111827] dark:hover:text-white"
                    }`}
                  >
                    <div className="font-bold text-xs">{m.label}</div>
                    <div className="text-[10px] text-slate-400 mt-1">{m.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="pt-4 border-t border-[#E5E7EB] dark:border-white/10 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-[#4B5563] dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="accent-[#1F5BFF] rounded"
            />
            <span>Don&apos;t show again</span>
          </label>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
              >
                Back
              </Button>
            )}

            {step < 4 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setStep((s) => s + 1)}
                className="bg-[#1F5BFF] hover:bg-[#1848cc] text-white"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleFinish}
                className="bg-[#1F5BFF] hover:bg-[#1848cc] text-white"
              >
                <span>Launch Terminal</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
