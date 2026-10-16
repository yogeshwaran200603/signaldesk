"use client";

import React, { HTMLAttributes } from "react";

export function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-surfaceElevated/60 border border-border/40 ${className}`}
      {...props}
    />
  );
}
