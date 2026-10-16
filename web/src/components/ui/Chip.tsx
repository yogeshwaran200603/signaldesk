"use client";

import React, { ButtonHTMLAttributes } from "react";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
  count?: number | string;
  icon?: React.ReactNode;
}

export function Chip({
  active = false,
  label,
  count,
  icon,
  className = "",
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-semibold transition-all duration-150 select-none border ${
        active
          ? "bg-brand-blue text-white border-brand-blue shadow-glow-blue-sm font-bold"
          : "bg-surface text-slate-400 hover:text-white hover:bg-surfaceHover border-border"
      } ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            active ? "bg-white/20 text-white" : "bg-surfaceElevated text-slate-400"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
