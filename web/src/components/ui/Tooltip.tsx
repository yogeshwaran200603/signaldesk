"use client";

import React, { useState } from "react";

export interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({
  content,
  children,
  position,
  side,
  className = "",
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const resolvedPosition = side || position || "top";

  const positionStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }[resolvedPosition];

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`absolute z-50 whitespace-nowrap px-2.5 py-1 text-2xs font-mono rounded-lg bg-surfaceElevated text-slate-200 border border-border shadow-octa-elevated pointer-events-none transition-all duration-150 ${positionStyles}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
