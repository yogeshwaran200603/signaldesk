"use client";

import React, { useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { BenefitStrip } from "@/components/landing/BenefitStrip";

// Dynamically import below-the-fold sections
const FeatureShowcase = dynamic(
  () => import("@/components/landing/FeatureShowcase").then((m) => m.FeatureShowcase),
  {
    ssr: false,
    loading: () => <div className="min-h-[400px] bg-slate-100 dark:bg-[#0E1422] animate-pulse" />,
  }
);

const ToolsGrid = dynamic(
  () => import("@/components/landing/ToolsGrid").then((m) => m.ToolsGrid),
  {
    ssr: false,
    loading: () => <div className="min-h-[300px] bg-transparent" />,
  }
);

const Footer = dynamic(
  () => import("@/components/landing/Footer").then((m) => m.Footer),
  { ssr: false }
);

const AuthModal = dynamic(
  () => import("@/components/landing/AuthModal").then((m) => m.AuthModal),
  { ssr: false }
);

export default function HomePage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("login");

  const handleOpenAuth = (mode: "login" | "signup") => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-transparent text-[#111827] dark:text-slate-100 selection:bg-[#1F5BFF] selection:text-white overflow-x-hidden">
      {/* 1. Header / Navbar (60px, white, 1px bottom border) */}
      <Navbar onOpenAuth={handleOpenAuth} />

      {/* 2. Hero Section (Headline 3 lines, subtext, blue button + link, stats row, right phone mockup) */}
      <Hero onOpenAuth={handleOpenAuth} />

      {/* 3. Benefit Strip of 4 items */}
      <BenefitStrip />

      {/* 4. Feature Showcase (3 Alternating Feature Blocks) */}
      <Suspense fallback={<div className="min-h-[400px] bg-slate-100 dark:bg-[#0E1422] animate-pulse" />}>
        <FeatureShowcase />
      </Suspense>

      {/* 5. Tools Grid (Risk Calculator, Market Hours IST, Trade Journal, Learning Hub) */}
      <Suspense fallback={<div className="min-h-[300px] bg-transparent" />}>
        <ToolsGrid />
      </Suspense>

      {/* 6. Repeated Benefit Strip */}
      <BenefitStrip />

      {/* 7. Statutory Regulatory Footer */}
      <Suspense fallback={<div className="min-h-[200px] bg-transparent" />}>
        <Footer />
      </Suspense>

      {/* Auth Modal when triggered */}
      {authModalOpen && (
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialMode={authModalMode}
        />
      )}
    </div>
  );
}
