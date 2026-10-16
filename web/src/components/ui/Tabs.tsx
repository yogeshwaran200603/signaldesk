"use client";

import React from "react";

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: "pill" | "underline" | "compact";
  className?: string;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = "pill",
  className = "",
}: TabsProps) {
  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-1 p-1 rounded-xl bg-surfaceElevated border border-border ${className}`}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all duration-150 flex items-center gap-1.5 ${
                isActive
                  ? "bg-brand-blue text-white shadow-glow-blue-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-surfaceHover"
              }`}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-white/20 text-white" : "bg-surfaceHover text-slate-400"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 p-1.5 rounded-2xl bg-surfaceElevated border border-border ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all duration-150 flex items-center justify-center gap-2 select-none ${
              isActive
                ? "bg-brand-blue text-white shadow-glow-blue-sm font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-surfaceHover"
            }`}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-white/20 text-white" : "bg-surfaceHover text-slate-400"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
