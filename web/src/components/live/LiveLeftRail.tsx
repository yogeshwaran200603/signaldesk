"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { 
  CandlestickChart, 
  Radio, 
  Briefcase, 
  RotateCcw, 
  BarChart3, 
  Settings, 
  SlidersHorizontal
} from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";

interface LiveLeftRailProps {
  onOpenSettings?: () => void;
}

export function LiveLeftRail({ onOpenSettings }: LiveLeftRailProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/live",
      label: "Live Workspace",
      icon: CandlestickChart,
      active: pathname === "/live",
    },
    {
      href: "/feed",
      label: "Signal Stream",
      icon: Radio,
      active: pathname === "/feed",
    },
    {
      href: "/portfolio",
      label: "Broker Watchlist",
      icon: Briefcase,
      active: pathname === "/portfolio",
    },
    {
      href: "/review",
      label: "Session Replay",
      icon: RotateCcw,
      active: pathname === "/review",
    },
    {
      href: "/performance",
      label: "Quant Analytics",
      icon: BarChart3,
      active: pathname === "/performance",
    },
  ];

  return (
    <aside className="hidden md:flex flex-col justify-between w-14 shrink-0 bg-white dark:bg-[#0E1422] border-r border-[#E5E7EB] dark:border-white/10 py-3 z-30 select-none">
      {/* Top Logo / Brand Anchor */}
      <div className="flex flex-col items-center gap-5">
        <Link
          href="/"
          className="relative w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center hover:scale-105 transition-transform border border-[#E5E7EB] dark:border-white/10 shadow-sm bg-white dark:bg-[#0E1422]"
          title="SignalDesk Home"
        >
          <Image
            src="/brand/logo.png"
            alt="SignalDesk Logo"
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
          />
        </Link>

        {/* Navigation Items */}
        <nav className="flex flex-col items-center gap-1.5 w-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Tooltip key={item.href} content={item.label} side="right">
                <Link
                  href={item.href}
                  className={`relative w-full h-11 flex items-center justify-center transition-colors ${
                    item.active
                      ? "text-[#1F5BFF] bg-[#E8F0FE] dark:bg-brand-blue/10 font-semibold"
                      : "text-[#6B7280] dark:text-slate-400 hover:text-[#111827] dark:hover:text-white hover:bg-slate-50 dark:hover:bg-bg-raised"
                  }`}
                >
                  {/* Left accent border and glow indicator for active route */}
                  {item.active && (
                    <div className="absolute left-0 top-1 bottom-1 w-1 bg-[#1F5BFF] rounded-r" />
                  )}
                  <Icon className="w-5 h-5" />
                </Link>
              </Tooltip>
            );
          })}
        </nav>
      </div>

      {/* Bottom Settings Trigger */}
      <div className="flex flex-col items-center gap-2">
        <Tooltip content="Terminal Preferences" side="right">
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[#6B7280] dark:text-slate-400 hover:text-[#111827] dark:hover:text-white hover:bg-slate-50 dark:hover:bg-bg-raised transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
