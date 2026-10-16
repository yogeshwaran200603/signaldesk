"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  CandlestickChart, 
  Radio, 
  Briefcase, 
  RotateCcw, 
  BarChart3,
  SlidersHorizontal
} from "lucide-react";

interface LiveMobileNavProps {
  onTogglePanelSheet?: () => void;
  passedCount?: number;
}

export function LiveMobileNav({ onTogglePanelSheet, passedCount = 0 }: LiveMobileNavProps) {
  const pathname = usePathname();

  const links = [
    { href: "/live", label: "Chart", icon: CandlestickChart },
    { href: "/feed", label: "Feed", icon: Radio },
    { href: "/portfolio", label: "Watchlist", icon: Briefcase },
    { href: "/review", label: "Review", icon: RotateCcw },
    { href: "/performance", label: "Stats", icon: BarChart3 },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-bg-card border-t border-slate-800/90 flex items-center justify-around px-2 z-40 select-none backdrop-blur-md">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 rounded-lg transition-colors ${
              isActive ? "text-brand-blue" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-[10px] font-medium">{link.label}</span>
          </Link>
        );
      })}

      {onTogglePanelSheet && (
        <button
          type="button"
          onClick={onTogglePanelSheet}
          className="flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 rounded-lg text-slate-400 hover:text-white"
        >
          <div className="relative">
            <SlidersHorizontal className="w-4 h-4" />
            {passedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-brand-blue" />
            )}
          </div>
          <span className="text-[10px] font-medium">Panel</span>
        </button>
      )}
    </nav>
  );
}
