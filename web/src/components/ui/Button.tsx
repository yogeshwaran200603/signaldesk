"use client";

import React, { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold transition-all duration-200 select-none rounded-xl disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50 focus-visible:ring-offset-2";

    const variantStyles = {
      primary:
        "bg-brand-blue hover:bg-brand-blueHover text-white shadow-glow-blue-sm border border-brand-blue/40",
      secondary:
        "bg-surfaceElevated hover:bg-surfaceHover text-slate-200 border border-border shadow-octa-card",
      outline:
        "bg-transparent hover:bg-surfaceHover text-slate-300 hover:text-white border border-border",
      ghost:
        "bg-transparent hover:bg-surfaceHover text-slate-400 hover:text-white",
      danger:
        "bg-danger hover:bg-danger-hover text-white shadow-glow-red border border-danger/40",
      success:
        "bg-success hover:bg-success-hover text-white shadow-glow-green border border-success/40",
    }[variant];

    const sizeStyles = {
      xs: "text-2xs px-2.5 py-1 gap-1 h-7",
      sm: "text-xs px-3 py-1.5 gap-1.5 h-8.5",
      md: "text-sm px-4 py-2 gap-2 h-10",
      lg: "text-base px-6 py-2.5 gap-2.5 h-12",
    }[size];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
