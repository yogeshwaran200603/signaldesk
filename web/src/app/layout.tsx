import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SignalDesk | Quantitative Trading Signals for Indian Equities",
  description:
    "Institutional SMC order blocks, liquidity sweeps, volume profiles, and WhatsApp alerts with pre-calculated Entry, Stop Loss, and Take Profit for NSE stocks.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.png", type: "image/png" },
      { url: "/brand/logo.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/brand/logo.png", sizes: "180x180", type: "image/png" },
    ],
  },
  keywords: [
    "trading signals",
    "NSE stocks",
    "smart money concepts",
    "SMC",
    "algorithmic trading",
    "Indian stock market",
    "quantitative finance",
  ],
};

import { DevHealthBanner } from "@/components/ui/DevHealthBanner";
import { OnboardingWrapper } from "@/components/ui/OnboardingWrapper";
import { FloatingHelpButton } from "@/components/ui/FloatingHelpButton";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body className="bg-background text-[#111827] dark:text-slate-100 min-h-screen flex flex-col font-sans antialiased selection:bg-[#1F5BFF] selection:text-white">
        <AuthProvider>
          <div className="flex-1 flex flex-col">{children}</div>
          <OnboardingWrapper />
          <FloatingHelpButton />
          {process.env.NODE_ENV === "development" && <DevHealthBanner />}
        </AuthProvider>
      </body>
    </html>
  );
}
