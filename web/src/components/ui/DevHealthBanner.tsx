"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { Activity, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

interface ServiceCheck {
  id: string;
  name: string;
  status: "ONLINE" | "OFFLINE" | "CHECKING" | "WARN";
  message: string;
}

export function DevHealthBanner() {
  const { user, validation } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [checks, setChecks] = useState<ServiceCheck[]>([
    { id: "api", name: "FastAPI Engine (:8000)", status: "CHECKING", message: "Probing /api/health..." },
    { id: "ws", name: "Live WebSocket", status: "CHECKING", message: "Testing ws://localhost:8000/ws/live..." },
    { id: "auth", name: "Firebase Auth", status: "CHECKING", message: "Checking configuration..." },
  ]);

  const engineUrl = process.env.NEXT_PUBLIC_ENGINE_URL?.replace(/\/$/, "") || "http://localhost:8000";

  const runHealthProbes = useCallback(async () => {
    // 1. Check Firebase Auth config
    const authStatus = validation.isValid
      ? user
        ? { status: "ONLINE" as const, message: `Signed in as ${user.email || user.uid}` }
        : { status: "WARN" as const, message: "Firebase configured, but no user currently signed in (Guest mode)" }
      : { status: "OFFLINE" as const, message: `Missing variables: ${validation.missingVars.join(", ")}` };

    // 2. Check Backend API
    let apiStatus: { status: "ONLINE" | "OFFLINE" | "WARN" | "CHECKING"; message: string } = {
      status: "CHECKING",
      message: "Probing...",
    };
    try {
      const res = await fetch(`${engineUrl}/api/health`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        apiStatus = {
          status: "ONLINE",
          message: `Reachable (Status: ${data.status || "OK"}, Mode: ${data.paper_mode ? "PAPER" : "LIVE"})`,
        };
      } else {
        apiStatus = { status: "WARN", message: `HTTP ${res.status} returned from ${engineUrl}/api/health` };
      }
    } catch (err: any) {
      apiStatus = {
        status: "OFFLINE",
        message: `Backend unreachable at ${engineUrl}. Ensure python engine is running.`,
      };
    }

    // 3. Check WebSocket
    let wsStatus: { status: "ONLINE" | "OFFLINE" | "WARN" | "CHECKING"; message: string } = {
      status: "CHECKING",
      message: "Testing connection...",
    };
    try {
      const wsUrl = engineUrl.replace(/^http/, "ws") + "/ws/live?chartOnly=true";
      const testWs = new WebSocket(wsUrl);
      const wsPromise = new Promise<{ status: "ONLINE" | "OFFLINE"; message: string }>((resolve) => {
        const timeout = setTimeout(() => {
          testWs.close();
          resolve({ status: "OFFLINE", message: `Connection timeout to ${wsUrl}` });
        }, 3000);

        testWs.onopen = () => {
          clearTimeout(timeout);
          testWs.close();
          resolve({ status: "ONLINE", message: `Handshake successful with ${wsUrl}` });
        };
        testWs.onerror = () => {
          clearTimeout(timeout);
          resolve({ status: "OFFLINE", message: `WebSocket refused connection at ${wsUrl}` });
        };
      });
      wsStatus = await wsPromise;
    } catch {
      wsStatus = { status: "OFFLINE", message: "WebSocket probe failed" };
    }

    setChecks([
      { id: "api", name: "FastAPI Engine (:8000)", ...apiStatus },
      { id: "ws", name: "Live WebSocket", ...wsStatus },
      { id: "auth", name: "Firebase Auth", ...authStatus },
    ]);
  }, [engineUrl, user, validation]);

  useEffect(() => {
    void runHealthProbes();
    const interval = setInterval(runHealthProbes, 20000);
    return () => clearInterval(interval);
  }, [runHealthProbes]);

  const hasFailure = checks.some((c) => c.status === "OFFLINE");
  const hasWarning = checks.some((c) => c.status === "WARN");

  return (
    <div className="fixed bottom-3 left-3 z-50 font-mono text-xs max-w-md">
      {/* Mini Toggle Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border shadow-lg transition ${
          hasFailure
            ? "bg-rose-950/80 border-rose-500/50 text-rose-300 hover:bg-rose-900/80"
            : hasWarning
            ? "bg-amber-950/80 border-amber-500/50 text-amber-300 hover:bg-amber-900/80"
            : "bg-slate-900/80 border-slate-700/60 text-slate-300 hover:bg-slate-800/80"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            hasFailure ? "bg-rose-400 animate-pulse" : hasWarning ? "bg-amber-400" : "bg-emerald-400"
          }`}
        />
        <span className="font-semibold text-[11px]">Dev Diagnostics</span>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      {/* Expanded Panel */}
      {isOpen && (
        <div className="mt-2 p-3.5 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-md text-slate-200 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-[11px] text-white flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-400" /> System Dependency Probes
            </span>
            <button
              type="button"
              onClick={runHealthProbes}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              title="Re-check now"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2">
            {checks.map((c) => (
              <div key={c.id} className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-200">{c.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      c.status === "ONLINE"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : c.status === "WARN"
                        ? "bg-amber-500/20 text-amber-300"
                        : c.status === "CHECKING"
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 break-all leading-tight">{c.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
