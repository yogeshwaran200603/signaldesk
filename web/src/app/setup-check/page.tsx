"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  validateFirebaseConfig,
  EnvVarCheck,
  app,
  auth,
} from "@/lib/firebase";
import { db } from "@/lib/firestore";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Terminal,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

export default function SetupCheckPage() {
  const [checks, setChecks] = useState<EnvVarCheck[]>([]);
  const [isAllValid, setIsAllValid] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = () => {
    const res = validateFirebaseConfig();
    setChecks(res.checks);
    setIsAllValid(res.isValid);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    try {
      // Test 1: Verify app instance
      if (!app) throw new Error("FirebaseApp instance is null");

      // Test 2: Check auth readiness
      if (!auth) throw new Error("FirebaseAuth instance is null");

      // Test 3: Check Firestore client readiness
      if (!db) throw new Error("FirebaseFirestore instance is null");

      setTestResult("OK: Firebase SDK is initialized and instances are ready. (If API key was recently added, rebuild/restart the server).");
    } catch (err: any) {
      setTestResult(`FAIL: Connection check failed: ${err.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark text-slate-100 p-6 sm:p-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Navigation header */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-brand-teal transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <span className="text-[11px] font-mono bg-slate-800 text-slate-400 px-2.5 py-1 rounded-md border border-slate-700">
            SignalDesk Diagnostic Tool
          </span>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-brand-teal" />
            Firebase Environment Diagnostics
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Validates required configuration in <code className="text-brand-teal font-mono bg-slate-900 px-1 py-0.5 rounded">web/.env.local</code> without printing or revealing secret values.
          </p>
        </div>

        {/* Overall Status Banner */}
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-center justify-between gap-4 ${
            isAllValid
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-3">
            {isAllValid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <div>
              <div className="font-bold">
                {isAllValid ? "All Environment Variables Configured" : "Configuration Issues Detected"}
              </div>
              <div className="text-[11px] opacity-80">
                {isAllValid
                  ? "Next.js can authenticate users and stream live Firestore signals."
                  : "Resolve failed items below to enable live Firebase Authentication."}
              </div>
            </div>
          </div>

          <button
            onClick={runDiagnostics}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shrink-0"
            title="Re-run check"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Diagnostic Items Table */}
        <div className="p-5 rounded-2xl bg-brand-surface/90 border border-brand-border space-y-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            Environment Variable Checks (web/.env.local)
          </h2>

          <div className="divide-y divide-brand-border/60">
            {checks.map((item) => (
              <div key={item.name} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="font-mono font-bold text-white">{item.name}</div>
                  {item.issue && (
                    <div className="text-[11px] text-rose-400 font-medium">
                      ⚠️ {item.issue}
                    </div>
                  )}
                </div>

                <div>
                  {item.status === "pass" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-400">
                      <XCircle className="w-3.5 h-3.5" /> FAIL
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SDK Readiness Verification */}
        <div className="p-5 rounded-2xl bg-brand-surface/90 border border-brand-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Firebase Client SDK Instances
            </h2>
            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="px-3 py-1.5 rounded-xl bg-brand-teal text-brand-dark font-bold text-xs hover:bg-emerald-400 transition disabled:opacity-50"
            >
              {testingConnection ? "Testing..." : "Verify SDK Readiness"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="p-3 rounded-xl bg-brand-dark border border-brand-border">
              <div className="text-[10px] text-slate-400 font-mono uppercase">App Instance</div>
              <div className="font-bold text-white mt-1">{app ? "Initialized" : "Null"}</div>
            </div>
            <div className="p-3 rounded-xl bg-brand-dark border border-brand-border">
              <div className="text-[10px] text-slate-400 font-mono uppercase">Auth Service</div>
              <div className="font-bold text-white mt-1">{auth ? "Ready" : "Null"}</div>
            </div>
            <div className="p-3 rounded-xl bg-brand-dark border border-brand-border">
              <div className="text-[10px] text-slate-400 font-mono uppercase">Firestore DB</div>
              <div className="font-bold text-white mt-1">{db ? "Ready" : "Null"}</div>
            </div>
          </div>

          {testResult && (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300">
              {testResult}
            </div>
          )}
        </div>

        {/* Step-by-Step Manual Checklist */}
        <div className="p-6 rounded-2xl bg-brand-surfaceElevated/60 border border-brand-border space-y-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-brand-teal" />
            Firebase Console Checklist
          </h2>

          <ol className="space-y-3 text-xs text-slate-400 list-decimal pl-4 leading-relaxed">
            <li>
              <strong className="text-white">API Key in web/.env.local:</strong> Ensure <code className="text-brand-teal font-mono">NEXT_PUBLIC_FIREBASE_API_KEY=AIza...</code> is set without quotes or spaces.
            </li>
            <li>
              <strong className="text-white">Authentication Providers:</strong> Go to Firebase Console &gt; Authentication &gt; Sign-in method. Ensure <strong className="text-white">Email/Password</strong> and <strong className="text-white">Google</strong> are enabled.
            </li>
            <li>
              <strong className="text-white">Authorized Domains:</strong> Go to Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains. Ensure <code className="text-brand-teal font-mono">localhost</code> is listed.
            </li>
            <li>
              <strong className="text-white">Cloud Firestore Database:</strong> Go to Firebase Console &gt; Build &gt; Firestore Database. Ensure the database is created in <strong className="text-white">Native mode</strong> (e.g., location <code className="font-mono">asia-south1</code>).
            </li>
            <li>
              <strong className="text-white">Restart Server:</strong> Next.js inlines <code className="font-mono">NEXT_PUBLIC_*</code> variables at build/startup. Run <code className="text-brand-teal font-mono">npm.cmd run build</code> and <code className="text-brand-teal font-mono">npm.cmd run start -- -p 3000</code> after updating <code className="font-mono">.env.local</code>.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
