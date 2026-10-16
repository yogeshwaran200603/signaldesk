"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

export interface StatProps {
  label: string;
  value: string | number;
  sublabel?: string;
  change?: number; // percentage or change value
  changeLabel?: string;
  trend?: "up" | "down" | "neutral";
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
  variant?: "default" | "elevated" | "accent";
  className?: string;
}

export function Stat({
  label,
  value,
  sublabel,
  change,
  changeLabel,
  trend,
  prefix,
  suffix,
  icon,
  variant = "default",
  className = "",
}: StatProps) {
  const calculatedTrend =
    trend || (change !== undefined ? (change > 0 ? "up" : change < 0 ? "down" : "neutral") : undefined);

  const variantStyles = {
    default: "bg-surface border-border",
    elevated: "bg-surfaceElevated border-borderStrong",
    accent: "bg-brand-blue/10 border-brand-blue/30",
  }[variant];

  return (
    <div
      className={`p-5 rounded-2xl border transition-all duration-200 shadow-octa-card ${variantStyles} ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-mono uppercase tracking-wider text-slate-400 font-semibold">{label}</span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5 font-mono tabular-nums">
        {prefix && <span className="text-sm font-semibold text-slate-400">{prefix}</span>}
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{value}</span>
        {suffix && <span className="text-xs font-semibold text-slate-400">{suffix}</span>}
      </div>

      {(sublabel || change !== undefined || changeLabel) && (
        <div className="mt-2 flex items-center justify-between text-2xs font-mono">
          {change !== undefined && (
            <span
              className={`inline-flex items-center gap-0.5 font-bold ${
                calculatedTrend === "up"
                  ? "text-success"
                  : calculatedTrend === "down"
                  ? "text-danger"
                  : "text-slate-400"
              }`}
            >
              {calculatedTrend === "up" && <ArrowUpRight className="w-3.5 h-3.5" />}
              {calculatedTrend === "down" && <ArrowDownRight className="w-3.5 h-3.5" />}
              {calculatedTrend === "neutral" && <Minus className="w-3.5 h-3.5" />}
              <span>{change > 0 ? `+${change}%` : `${change}%`}</span>
            </span>
          )}
          {sublabel && <span className="text-slate-500">{sublabel}</span>}
          {changeLabel && <span className="text-slate-500">{changeLabel}</span>}
        </div>
      )}
    </div>
  );
}
