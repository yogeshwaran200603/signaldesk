"use client";

import React, { useState } from "react";
import { 
  BarChart2, 
  LineChart, 
  Layers, 
  Maximize2, 
  Minimize2, 
  Crosshair, 
  Save, 
  Check, 
  Sliders, 
  ChevronDown 
} from "lucide-react";
import type { OverlayToggles } from "@/components/live/LiveCandleChart";
import { Tooltip } from "@/components/ui/Tooltip";

interface LiveChartToolbarProps {
  interval: string;
  onIntervalChange: (tf: string) => void;
  timeframes: Array<{ id: string; label: string }>;
  chartType: "candles" | "line";
  onChartTypeChange: (type: "candles" | "line") => void;
  overlayToggles: OverlayToggles;
  onToggleOverlay: (key: keyof OverlayToggles) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onSaveLayout: () => void;
  isSaved?: boolean;
}

export function LiveChartToolbar({
  interval,
  onIntervalChange,
  timeframes,
  chartType,
  onChartTypeChange,
  overlayToggles,
  onToggleOverlay,
  isExpanded,
  onToggleExpanded,
  onSaveLayout,
  isSaved = false,
}: LiveChartToolbarProps) {
  const [indicatorMenuOpen, setIndicatorMenuOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white dark:bg-[#0E1422] border-b border-[#E5E7EB] dark:border-white/10 text-xs select-none">
      {/* Left: Timeframe chips & Chart Type */}
      <div className="flex items-center gap-1.5">
        {/* Timeframes */}
        <div className="flex items-center gap-1 bg-[#F8FAFC] dark:bg-[#151C2E] p-1 rounded-xl border border-[#E5E7EB] dark:border-white/10">
          {timeframes.map((tf) => {
            const active = interval === tf.id;
            return (
              <button
                key={tf.id}
                type="button"
                onClick={() => onIntervalChange(tf.id)}
                className={`px-2.5 py-1 rounded-lg font-mono font-semibold text-[11px] transition-all ${
                  active
                    ? "bg-[#1F5BFF] text-white shadow-sm"
                    : "text-[#6B7280] dark:text-slate-400 hover:text-[#111827] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C253D]"
                }`}
              >
                {tf.label}
              </button>
            );
          })}
        </div>

        {/* Chart type toggle */}
        <div className="hidden sm:flex items-center bg-[#F8FAFC] dark:bg-[#151C2E] p-1 rounded-xl border border-[#E5E7EB] dark:border-white/10">
          <Tooltip content="Candlestick Chart" side="bottom">
            <button
              type="button"
              onClick={() => onChartTypeChange("candles")}
              className={`p-1.5 rounded-lg transition-colors ${
                chartType === "candles"
                  ? "bg-[#1F5BFF] text-white"
                  : "text-[#6B7280] dark:text-slate-400 hover:text-[#111827] dark:hover:text-white"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          <Tooltip content="Line Chart" side="bottom">
            <button
              type="button"
              onClick={() => onChartTypeChange("line")}
              className={`p-1.5 rounded-lg transition-colors ${
                chartType === "line"
                  ? "bg-[#1F5BFF] text-white"
                  : "text-[#6B7280] dark:text-slate-400 hover:text-[#111827] dark:hover:text-white"
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Right: Indicator Overlay Toggles, Save Layout, Fullscreen */}
      <div className="flex items-center gap-2">
        {/* SMC Overlays Toggle Pills */}
        <div className="hidden md:flex items-center gap-1 bg-[#F8FAFC] dark:bg-[#151C2E] p-1 rounded-xl border border-[#E5E7EB] dark:border-white/10 text-[11px] font-mono">
          <button
            type="button"
            onClick={() => onToggleOverlay("orderBlocks")}
            className={`px-2 py-0.5 rounded-lg font-medium transition-colors ${
              overlayToggles.orderBlocks
                ? "bg-[#E8F0FE] text-[#1F5BFF] border border-[#1F5BFF]/30"
                : "text-[#6B7280] dark:text-slate-500 hover:text-[#111827] dark:hover:text-slate-300"
            }`}
          >
            OB
          </button>

          <button
            type="button"
            onClick={() => onToggleOverlay("fvgs")}
            className={`px-2 py-0.5 rounded-lg font-medium transition-colors ${
              overlayToggles.fvgs
                ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            FVG
          </button>

          <button
            type="button"
            onClick={() => onToggleOverlay("vwap")}
            className={`px-2 py-0.5 rounded-lg font-medium transition-colors ${
              overlayToggles.vwap
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            VWAP
          </button>

          <button
            type="button"
            onClick={() => onToggleOverlay("liquidity")}
            className={`px-2 py-0.5 rounded-lg font-medium transition-colors ${
              overlayToggles.liquidity
                ? "bg-warning/20 text-warning border border-warning/30"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Liquidity
          </button>
        </div>

        {/* Save Layout State Indicator */}
        <Tooltip content="Persist chart layout and indicators" side="bottom">
          <button
            type="button"
            onClick={onSaveLayout}
            className={`p-1.5 rounded-xl border flex items-center gap-1.5 text-xs transition-colors ${
              isSaved
                ? "bg-success/15 text-success border-success/30"
                : "bg-bg-base text-slate-400 hover:text-white border-slate-800"
            }`}
          >
            {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline text-[11px] font-mono">
              {isSaved ? "Saved" : "Save"}
            </span>
          </button>
        </Tooltip>

        {/* Fullscreen toggle */}
        <Tooltip content={isExpanded ? "Restore View" : "Maximize Chart"} side="bottom">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="p-1.5 rounded-xl bg-bg-base text-slate-400 hover:text-white border border-slate-800 transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
