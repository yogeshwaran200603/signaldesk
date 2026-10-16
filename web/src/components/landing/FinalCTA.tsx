"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Zap, CheckCircle2, Shield, Mail, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface FinalCTAProps {
  onOpenAuth: (mode: "login" | "signup") => void;
}

export function FinalCTA({ onOpenAuth }: FinalCTAProps) {
  const { user, login, signup, loginWithGoogle } = useAuth();
  const router = useRouter();

  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      router.push("/portfolio");
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle();
      router.push("/portfolio");
    } catch (err: any) {
      setError(err.message || "Google Sign-In failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative py-28 lg:py-36 px-4 sm:px-6 lg:px-8 border-t border-brand-border bg-gradient-to-b from-brand-dark via-brand-navy to-brand-dark overflow-hidden">
      {/* Background glow and subtle mesh */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-brand-teal/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-brand-amber/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-12 items-center relative z-10">
        {/* Left Column: Pitch */}
        <div className="lg:col-span-7 space-y-7 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-teal/10 border border-brand-teal/20 text-brand-teal">
            <Zap className="w-3.5 h-3.5" /> Start Paper Trading Free
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white font-display leading-tight">
            Ready to eliminate <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-teal via-emerald-300 to-brand-sky">
              emotional trading?
            </span>
          </h2>

          <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
            Configure your NSE watchlist in seconds. Get institutional SMC confluences with explicit Entry, Stop Loss, and Take Profit sent directly to your phone.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-brand-teal shrink-0" />
              <span>Full access to Indian stock screener & SMC strategy engine</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-brand-teal shrink-0" />
              <span>Direct WhatsApp message alert dispatch</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-brand-teal shrink-0" />
              <span>Zero broker credentials or order execution permission required</span>
            </div>
          </div>
        </div>

        {/* Right Column: Direct Sign-up / Login Card */}
        <div className="lg:col-span-5">
          <div className="w-full max-w-md mx-auto p-7 sm:p-8 rounded-3xl bg-brand-surface/90 border border-brand-border/90 shadow-2xl shadow-black relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-teal/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="space-y-1.5 mb-6">
              <h3 className="text-2xl font-bold text-white font-display">
                {isLogin ? "Sign In to SignalDesk" : "Create Free Account"}
              </h3>
              <p className="text-xs text-slate-400">
                {isLogin
                  ? "Access your live watchlist and quantitative signals."
                  : "Start receiving algorithmic trade setups today."}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                {error}
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="trader@domain.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-brand-dark border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-teal transition"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-brand-dark border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-teal transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-teal hover:bg-emerald-400 font-semibold text-sm text-brand-dark transition flex items-center justify-center gap-2 mt-2 shadow-lg shadow-brand-teal/20 disabled:opacity-50"
              >
                {loading ? "Please wait..." : isLogin ? "Sign In" : "Get Started Free"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="relative my-4 text-center text-xs text-slate-500">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <span className="relative bg-brand-surface px-2">OR</span>
            </div>

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-sm font-medium text-white transition flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </button>

            {/* Toggle Login / Signup */}
            <div className="mt-5 text-center text-xs text-slate-400">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setIsLogin(!isLogin);
                }}
                className="text-brand-teal hover:underline font-semibold"
              >
                {isLogin ? "Sign Up" : "Sign In"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
