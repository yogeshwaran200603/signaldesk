"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = "Failed to load data",
  message,
  onRetry,
  retryLabel = "Retry",
  className = "",
}: ErrorStateProps) {
  return (
    <div
      className={`p-6 rounded-2xl bg-danger-soft border border-danger-border text-center space-y-3.5 max-w-lg mx-auto ${className}`}
    >
      <div className="w-10 h-10 rounded-2xl bg-danger/20 border border-danger/40 flex items-center justify-center mx-auto text-danger shadow-glow-red">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-white">{title}</h4>
        <p className="text-xs text-rose-300 font-mono leading-relaxed max-w-sm mx-auto">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-danger/20 hover:bg-danger/30 border border-danger/40 text-rose-200 text-xs font-mono font-semibold transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {retryLabel}
        </button>
      )}
    </div>
  );
}
