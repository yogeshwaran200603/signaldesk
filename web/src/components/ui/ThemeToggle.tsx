"use client";

import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("signaldesk-theme") as "dark" | "light" | null;
    if (stored === "dark") {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    } else {
      setTheme("light");
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("signaldesk-theme", next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`w-10 h-10 rounded-lg bg-white hover:bg-slate-50 dark:bg-[#151C2E] dark:hover:bg-[#1C253D] text-[#4B5563] dark:text-slate-300 border border-[#E5E7EB] dark:border-white/10 flex items-center justify-center transition-all duration-200 select-none ${className}`}
      title={mounted && theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle visual theme"
    >
      {mounted && theme === "dark" ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-[#1F5BFF] transition-transform duration-200 hover:-rotate-12" />
      )}
    </button>
  );
}
