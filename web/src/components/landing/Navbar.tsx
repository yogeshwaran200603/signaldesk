"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Menu, X, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface NavbarProps {
  onOpenAuth: (mode: "login" | "signup") => void;
}

export function Navbar({ onOpenAuth }: NavbarProps) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: "Terminal", href: "/live" },
    { label: "Watchlist", href: "/portfolio" },
    { label: "Performance", href: "/performance" },
    { label: "Checklist", href: "#checklist" },
    { label: "Tools", href: "#tools" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-[60px] bg-white dark:bg-[#0E1422] border-b border-[#E5E7EB] dark:border-white/10 transition-colors duration-200">
      <div className="max-w-[1920px] mx-auto h-full px-6 sm:px-8 lg:px-12 flex items-center justify-between">
        {/* Left side: Logo + Navigation Links */}
        <div className="flex items-center gap-10 lg:gap-14">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group select-none shrink-0">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 shadow-sm border border-[#E5E7EB]/80 dark:border-white/10 bg-white dark:bg-[#0E1422]">
              <Image
                src="/brand/logo.png"
                alt="SignalDesk Logo"
                width={32}
                height={32}
                priority
                className="w-8 h-8 object-contain"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold tracking-tight text-[#111827] dark:text-white font-sans">
                Signal<span className="text-[#1F5BFF]">Desk</span>
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links: 16px, medium weight, #1F2937 in light */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[16px] font-medium text-[#1F2937] hover:text-[#1F5BFF] dark:text-slate-200 dark:hover:text-[#1F5BFF] transition-colors duration-150"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side: Auth / Workspace Buttons & Theme Toggle */}
        <div className="hidden sm:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/portfolio"
                className="h-[40px] px-4 rounded-lg text-sm font-semibold text-[#1F5BFF] bg-[#E8F0FE] hover:bg-[#d8e7fe] dark:bg-[#1F5BFF]/15 dark:hover:bg-[#1F5BFF]/25 flex items-center justify-center transition"
              >
                Dashboard
              </Link>
              <Link
                href="/live"
                className="h-[40px] px-5 rounded-lg text-sm font-semibold text-white bg-[#1F5BFF] hover:bg-[#1848cc] flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm transition"
              >
                <span>Open workspace</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenAuth("login")}
                className="h-[40px] px-5 rounded-lg text-sm font-semibold text-[#1F5BFF] bg-[#E8F0FE] hover:bg-[#d8e7fe] dark:bg-[#1F5BFF]/15 dark:hover:bg-[#1F5BFF]/25 flex items-center justify-center transition"
              >
                Log in
              </button>
              <Link
                href="/live"
                className="h-[40px] px-5 rounded-lg text-sm font-semibold text-white bg-[#1F5BFF] hover:bg-[#1848cc] flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm transition"
              >
                <span>Open workspace</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Link>
            </div>
          )}

          <ThemeToggle className="h-[40px] w-[40px]" />
        </div>

        {/* Mobile menu toggle & ThemeToggle */}
        <div className="flex sm:hidden items-center gap-2">
          <ThemeToggle className="h-[36px] w-[36px]" />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-[#1F2937] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-[#E5E7EB] dark:border-white/10"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-b border-[#E5E7EB] dark:border-white/10 bg-white dark:bg-[#0E1422] shadow-xl px-6 py-5 space-y-4">
          <div className="flex flex-col space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-[16px] font-medium text-[#1F2937] dark:text-slate-200 hover:text-[#1F5BFF] transition"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="pt-3 border-t border-[#E5E7EB] dark:border-white/10 flex flex-col gap-2.5">
            {user ? (
              <Link href="/portfolio" onClick={() => setMobileMenuOpen(false)}>
                <button
                  type="button"
                  className="w-full h-[44px] rounded-lg bg-[#1F5BFF] text-white font-semibold text-sm flex items-center justify-center"
                >
                  Go to Portfolio
                </button>
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth("login");
                  }}
                  className="w-full h-[40px] rounded-lg bg-[#E8F0FE] text-[#1F5BFF] text-sm font-semibold flex items-center justify-center"
                >
                  Log in
                </button>
                <Link href="/live" onClick={() => setMobileMenuOpen(false)}>
                  <button
                    type="button"
                    className="w-full h-[44px] rounded-lg bg-[#1F5BFF] text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                  >
                    <span>Open workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
