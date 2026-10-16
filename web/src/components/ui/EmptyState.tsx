"use client";

import React from "react";
import { Layers } from "lucide-react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`p-8 sm:p-12 rounded-3xl bg-surface/50 border border-border border-dashed text-center space-y-3.5 max-w-xl mx-auto ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-surfaceElevated border border-border flex items-center justify-center mx-auto text-slate-400 shadow-octa-card">
        {icon || <Layers className="w-6 h-6 text-slate-500" />}
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-white">{title}</h4>
        <p className="text-xs text-slate-400 font-mono leading-relaxed max-w-sm mx-auto">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
