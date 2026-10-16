"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  LineStyle,
  Time,
} from "lightweight-charts";
import { Layers, Eye, EyeOff, Maximize2, Minimize2 } from "lucide-react";

export interface CandleBar {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  isClosed?: boolean;
}

export interface ChartOverlays {
  orderBlocks: Array<{
    type: "BULLISH" | "BEARISH";
    top: number;
    bottom: number;
    mitigated?: boolean;
  }>;
  fvgs: Array<{
    type: "BULLISH" | "BEARISH";
    top: number;
    bottom: number;
  }>;
  liquidityLevels: Array<{
    price: number;
    type: "SUPPORT" | "RESISTANCE";
    touches: number;
  }>;
  vwap: Array<{
    time: number;
    value: number;
  }>;
  poc: number | null;
}

export interface ConfirmedSignalOverlay {
  id: string;
  side: "BUY" | "SELL";
  entry: number;
  sl: number;
  tp: number;
  rr: number;
  state: string;
  candleTimestamp?: string;
}

export interface OverlayToggles {
  orderBlocks: boolean;
  fvgs: boolean;
  liquidity: boolean;
  vwap: boolean;
  tradeLevels: boolean;
}

interface LiveCandleChartProps {
  symbol: string;
  assetClass?: "equity" | "crypto" | "forex";
  interval: string;
  candles: CandleBar[];
  latestFormingCandle?: CandleBar | null;
  isTransitioning?: boolean;
  overlays?: ChartOverlays;
  confirmedSignal?: ConfirmedSignalOverlay | null;
  overlayToggles?: OverlayToggles;
  onToggleOverlay?: (key: keyof OverlayToggles) => void;
}

const DEFAULT_TOGGLES: OverlayToggles = {
  orderBlocks: true,
  fvgs: true,
  liquidity: true,
  vwap: true,
  tradeLevels: true,
};

function toChartTime(raw: number | string): Time {
  if (typeof raw === "number") {
    return raw as Time;
  }
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    return Math.floor(parsed / 1000) as Time;
  }
  return Math.floor(Date.now() / 1000) as Time;
}

export default function LiveCandleChart({
  symbol,
  assetClass = "equity",
  interval,
  candles,
  latestFormingCandle,
  isTransitioning = false,
  overlays,
  confirmedSignal = null,
  overlayToggles = DEFAULT_TOGGLES,
  onToggleOverlay,
}: LiveCandleChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } | null>(null);

  const decimals =
    assetClass === "forex"
      ? 4
      : assetClass === "crypto" && candles.length > 0 && candles[candles.length - 1].close < 2
        ? 4
        : 2;

  // 1. Initialize Lightweight Chart instance
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chartHeight = isExpanded ? 660 : 500;
    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    const chartBg = isDark ? "#060A14" : "#FFFFFF";
    const textColor = isDark ? "#94A3B8" : "#4B5563";
    const gridColor = isDark ? "rgba(21, 28, 46, 0.6)" : "#F1F5F9";
    const borderColor = isDark ? "rgba(21, 28, 46, 0.8)" : "#E5E7EB";
    const crosshairLabelBg = isDark ? "#0E1422" : "#111827";

    const chart = createChart(el, {
      width: el.clientWidth,
      height: chartHeight,
      layout: {
        background: { type: ColorType.Solid, color: chartBg },
        textColor: textColor,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(31, 91, 255, 0.45)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: crosshairLabelBg,
        },
        horzLine: {
          color: "rgba(31, 91, 255, 0.45)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: crosshairLabelBg,
        },
      },
      rightPriceScale: {
        borderColor: borderColor,
        scaleMargins: {
          top: 0.08,
          bottom: 0.22,
        },
      },
      timeScale: {
        borderColor: borderColor,
        timeVisible: interval !== "1d",
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 9,
      },
    });

    // Theme mutation observer
    const observer = new MutationObserver(() => {
      const darkNow = document.documentElement.classList.contains("dark");
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: darkNow ? "#060A14" : "#FFFFFF" },
          textColor: darkNow ? "#94A3B8" : "#4B5563",
        },
        grid: {
          vertLines: { color: darkNow ? "rgba(21, 28, 46, 0.6)" : "#F1F5F9" },
          horzLines: { color: darkNow ? "rgba(21, 28, 46, 0.6)" : "#F1F5F9" },
        },
        rightPriceScale: { borderColor: darkNow ? "rgba(21, 28, 46, 0.8)" : "#E5E7EB" },
        timeScale: { borderColor: darkNow ? "rgba(21, 28, 46, 0.8)" : "#E5E7EB" },
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#16C784",
      downColor: "#EA3943",
      borderUpColor: "#16C784",
      borderDownColor: "#EA3943",
      wickUpColor: "#16C784",
      wickDownColor: "#EA3943",
      priceFormat: {
        type: "price",
        precision: decimals,
        minMove: Number((1 / Math.pow(10, decimals)).toFixed(decimals)),
      },
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    const vwapSeries = chart.addLineSeries({
      color: "#2F6BFF",
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        setHoveredBar(null);
        return;
      }
      const cData = param.seriesData.get(candleSeries) as any;
      const vData = param.seriesData.get(volumeSeries) as any;
      if (cData && typeof cData.open === "number") {
        setHoveredBar({
          open: cData.open,
          high: cData.high,
          low: cData.low,
          close: cData.close,
          volume: vData?.value ?? 0,
        });
      }
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    vwapSeriesRef.current = vwapSeries;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: isExpanded ? 660 : 500,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      vwapSeriesRef.current = null;
      priceLinesRef.current = [];
    };
  }, [isExpanded, interval, decimals]);

  // 2. Populate historical + forming candles when dataset changes
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart) return;

    if (!candles || candles.length === 0) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      return;
    }

    const dedupMap = new Map<number, CandleBar>();
    for (const bar of candles) {
      const tSec = Number(toChartTime(bar.time));
      dedupMap.set(tSec, bar);
    }

    const sortedTimes = Array.from(dedupMap.keys()).sort((a, b) => a - b);
    const cData = sortedTimes.map((tSec) => {
      const b = dedupMap.get(tSec)!;
      return {
        time: tSec as Time,
        open: Number(b.open),
        high: Number(b.high),
        low: Number(b.low),
        close: Number(b.close),
      };
    });

    const vData = sortedTimes.map((tSec) => {
      const b = dedupMap.get(tSec)!;
      const isUp = Number(b.close) >= Number(b.open);
      return {
        time: tSec as Time,
        value: Number(b.volume ?? 0),
        color: isUp ? "rgba(16, 185, 129, 0.28)" : "rgba(244, 63, 94, 0.28)",
      };
    });

    candleSeries.setData(cData);
    volumeSeries.setData(vData);
  }, [candles, symbol, interval]);

  // 3. Real-time in-place update of the forming candle on live tick
  useEffect(() => {
    if (!latestFormingCandle) return;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries) return;

    try {
      const tSec = toChartTime(latestFormingCandle.time);
      candleSeries.update({
        time: tSec,
        open: Number(latestFormingCandle.open),
        high: Number(latestFormingCandle.high),
        low: Number(latestFormingCandle.low),
        close: Number(latestFormingCandle.close),
      });
      const isUp = Number(latestFormingCandle.close) >= Number(latestFormingCandle.open);
      volumeSeries.update({
        time: tSec,
        value: Number(latestFormingCandle.volume ?? 0),
        color: isUp ? "rgba(16, 185, 129, 0.4)" : "rgba(244, 63, 94, 0.4)",
      });
    } catch {
      // Ignore out-of-order chart update if snapshot is mid-reload
    }
  }, [latestFormingCandle]);

  // 4. Render Overlays (Order Blocks, FVGs, Liquidity Pools, VWAP/POC, and Confirmed Entry/SL/TP)
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const vwapSeries = vwapSeriesRef.current;
    if (!candleSeries || !vwapSeries) return;

    for (const line of priceLinesRef.current) {
      try {
        candleSeries.removePriceLine(line);
      } catch {}
    }
    priceLinesRef.current = [];

    // 4a. VWAP line series + Volume Profile POC horizontal line
    if (overlayToggles.vwap && overlays?.vwap?.length) {
      const vwapMap = new Map<number, number>();
      for (const pt of overlays.vwap) {
        vwapMap.set(Number(pt.time), Number(pt.value));
      }
      const sortedVwap = Array.from(vwapMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([t, val]) => ({ time: t as Time, value: val }));
      vwapSeries.setData(sortedVwap);

      if (overlays.poc && overlays.poc > 0) {
        const pocLine = candleSeries.createPriceLine({
          price: overlays.poc,
          color: "#F59E0B",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: "VP POC",
        });
        priceLinesRef.current.push(pocLine);
      }
    } else {
      vwapSeries.setData([]);
    }

    // 4b. Order Blocks (top & bottom zone boundaries)
    if (overlayToggles.orderBlocks && overlays?.orderBlocks?.length) {
      for (const ob of overlays.orderBlocks.slice(-2)) {
        const isBull = ob.type === "BULLISH";
        const color = isBull ? "rgba(16, 185, 129, 0.65)" : "rgba(244, 63, 94, 0.65)";
        const topLine = candleSeries.createPriceLine({
          price: ob.top,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: `${isBull ? "Bull" : "Bear"} OB Top`,
        });
        const botLine = candleSeries.createPriceLine({
          price: ob.bottom,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${isBull ? "Bull" : "Bear"} OB`,
        });
        priceLinesRef.current.push(topLine, botLine);
      }
    }

    // 4c. Fair Value Gaps (FVGs)
    if (overlayToggles.fvgs && overlays?.fvgs?.length) {
      for (const fvg of overlays.fvgs.slice(-2)) {
        const isBull = fvg.type === "BULLISH";
        const color = isBull ? "rgba(56, 189, 248, 0.55)" : "rgba(168, 85, 247, 0.55)";
        const midPrice = (fvg.top + fvg.bottom) / 2;
        const fvgLine = candleSeries.createPriceLine({
          price: midPrice,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.SparseDotted,
          axisLabelVisible: true,
          title: `${isBull ? "Bull" : "Bear"} FVG`,
        });
        priceLinesRef.current.push(fvgLine);
      }
    }

    // 4d. Liquidity Levels (Equal Highs/Lows & S/R Pools)
    if (overlayToggles.liquidity && overlays?.liquidityLevels?.length) {
      for (const liq of overlays.liquidityLevels.slice(-3)) {
        const liqLine = candleSeries.createPriceLine({
          price: liq.price,
          color:
            liq.type === "RESISTANCE"
              ? "rgba(251, 191, 36, 0.55)"
              : "rgba(45, 212, 191, 0.55)",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `Liq (${liq.touches}x)`,
        });
        priceLinesRef.current.push(liqLine);
      }
    }

    // 4e. Draw Entry, SL, and TP lines ONLY when a signal is CONFIRMED or ACTIVE
    if (
      overlayToggles.tradeLevels &&
      confirmedSignal &&
      (confirmedSignal.state === "CONFIRMED" ||
        confirmedSignal.state === "ACTIVE" ||
        confirmedSignal.state === "TP HIT" ||
        confirmedSignal.state === "SL HIT")
    ) {
      const entryLine = candleSeries.createPriceLine({
        price: confirmedSignal.entry,
        color: "#38BDF8",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `${confirmedSignal.side} ENTRY`,
      });
      const slLine = candleSeries.createPriceLine({
        price: confirmedSignal.sl,
        color: "#F43F5E",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "STOP LOSS",
      });
      const tpLine = candleSeries.createPriceLine({
        price: confirmedSignal.tp,
        color: "#10B981",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `TAKE PROFIT (1:${confirmedSignal.rr.toFixed(1)})`,
      });
      priceLinesRef.current.push(entryLine, slLine, tpLine);
    }
  }, [overlays, confirmedSignal, overlayToggles]);

  const activeBar =
    hoveredBar ||
    (candles.length > 0
      ? {
          open: candles[candles.length - 1].open,
          high: candles[candles.length - 1].high,
          low: candles[candles.length - 1].low,
          close: candles[candles.length - 1].close,
          volume: candles[candles.length - 1].volume ?? 0,
        }
      : null);

  return (
    <div
      className={`relative bg-white dark:bg-[#070B14] rounded-xl border border-[#E5E7EB] dark:border-slate-800/90 overflow-hidden shadow-sm transition-opacity duration-200 ease-out ${
        isTransitioning ? "opacity-60" : "opacity-100"
      }`}
    >
      {/* Top OHLCV Telemetry Bar + Overlay Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#F8FAFC] dark:bg-slate-900/80 border-b border-[#E5E7EB] dark:border-slate-800/80 text-xs">
        <div className="flex flex-wrap items-center gap-3.5 font-mono tabular-nums">
          <span className="text-[#111827] dark:text-slate-300 font-semibold">
            {symbol.replace(/-EQ$/i, "")}{" "}
            <span className="text-[#1F5BFF]">· {interval === "1d" ? "1D" : interval}</span>
          </span>
          {activeBar && (
            <>
              <span className="text-[#6B7280] dark:text-slate-400">
                O <strong className="text-[#111827] dark:text-slate-200">{activeBar.open.toFixed(decimals)}</strong>
              </span>
              <span className="text-[#6B7280] dark:text-slate-400">
                H <strong className="text-[#16A34A]">{activeBar.high.toFixed(decimals)}</strong>
              </span>
              <span className="text-[#6B7280] dark:text-slate-400">
                L <strong className="text-[#DC2626]">{activeBar.low.toFixed(decimals)}</strong>
              </span>
              <span className="text-[#6B7280] dark:text-slate-400">
                C{" "}
                <strong
                  className={
                    activeBar.close >= activeBar.open ? "text-[#16A34A]" : "text-[#DC2626]"
                  }
                >
                  {activeBar.close.toFixed(decimals)}
                </strong>
              </span>
              <span className="text-[#6B7280] dark:text-slate-500 hidden sm:inline">
                Vol{" "}
                <strong className="text-[#111827] dark:text-slate-300">
                  {Math.round(activeBar.volume).toLocaleString("en-IN")}
                </strong>
              </span>
            </>
          )}
        </div>

        {/* SMC / Volume Overlay Toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          {onToggleOverlay && (
            <>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280] dark:text-slate-500 mr-1 hidden xl:inline-flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#1F5BFF]" /> Overlays:
              </span>
              {(
                [
                  { key: "orderBlocks", label: "OB" },
                  { key: "fvgs", label: "FVG" },
                  { key: "liquidity", label: "Liquidity" },
                  { key: "vwap", label: "VWAP + POC" },
                  { key: "tradeLevels", label: "Entry/SL/TP" },
                ] as const
              ).map((item) => {
                const active = overlayToggles[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onToggleOverlay(item.key)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-semibold border transition ${
                      active
                        ? "bg-[#E8F0FE] text-[#1F5BFF] border-[#1F5BFF]/30 dark:bg-brand-blue/15 dark:text-brand-blue"
                        : "bg-white dark:bg-slate-900 text-[#6B7280] dark:text-slate-500 border-[#E5E7EB] dark:border-slate-800 hover:text-[#111827]"
                    }`}
                    aria-pressed={active}
                    title={`Toggle ${item.label} overlay`}
                  >
                    {active ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                    {item.label}
                  </button>
                );
              })}
            </>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#6B7280] dark:text-slate-400 hover:text-[#111827] dark:hover:text-white border border-[#E5E7EB] dark:border-slate-800 transition ml-1"
            aria-label={isExpanded ? "Collapse chart height" : "Expand chart height"}
            title={isExpanded ? "Standard height" : "Expand chart"}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative w-full">
        <div
          ref={containerRef}
          className="w-full"
          style={{ height: isExpanded ? 660 : 500 }}
        />
      </div>
    </div>
  );
}
