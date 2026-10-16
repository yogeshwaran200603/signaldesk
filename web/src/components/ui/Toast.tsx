"use client";

import React from "react";
import { CheckCircle, AlertTriangle, Info, X } from "lucide-react";

export interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  link?: string;
}

export interface ToastProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        const isError = toast.type === "error";

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-octa-elevated border flex items-start gap-3 transition-all duration-200 transform translate-y-0 ${
              isSuccess
                ? "bg-slate-900/95 border-success/40 text-slate-100"
                : isError
                ? "bg-slate-900/95 border-danger/40 text-slate-100"
                : "bg-slate-900/95 border-brand-blue/40 text-slate-100"
            }`}
          >
            {isSuccess && <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />}
            {isError && <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />}
            {!isSuccess && !isError && <Info className="w-5 h-5 text-brand-blue shrink-0 mt-0.5" />}

            <div className="flex-1 text-xs font-mono space-y-1">
              <p className="leading-snug">{toast.message}</p>
              {toast.link && (
                <a
                  href={toast.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-blue hover:underline inline-block font-bold"
                >
                  View Details →
                </a>
              )}
            </div>

            <button
              type="button"
              onClick={() => onRemove(toast.id)}
              className="text-slate-500 hover:text-white p-1 rounded hover:bg-slate-800"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
