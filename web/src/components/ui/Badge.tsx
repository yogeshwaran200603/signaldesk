"use client";

import React, { HTMLAttributes } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "danger" | "warning" | "info" | "blue" | "outline" | "paper" | "live";
  size?: "sm" | "md";
}

export function Badge({
  className = "",
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: "text-[10px] px-2 py-0.5 gap-1",
    md: "text-xs px-2.5 py-1 gap-1.5",
  }[size];

  const variantStyles = {
    default: "bg-surfaceElevated text-slate-300 border border-border",
    success: "bg-success-soft text-success border border-success-border font-bold",
    danger: "bg-danger-soft text-danger border border-danger-border font-bold",
    warning: "bg-warning-soft text-warning border border-warning-border font-bold",
    info: "bg-sky-500/15 text-sky-400 border border-sky-500/30 font-medium",
    blue: "bg-brand-blue/15 text-brand-blue border border-brand-blue/30 font-semibold",
    outline: "bg-transparent text-slate-400 border border-border",
    paper: "bg-amber-500/15 text-amber-300 border border-amber-500/40 font-bold tracking-wider uppercase",
    live: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 font-bold tracking-wider uppercase",
  }[variant];

  return (
    <span
      className={`inline-flex items-center font-mono rounded-full font-semibold select-none ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
