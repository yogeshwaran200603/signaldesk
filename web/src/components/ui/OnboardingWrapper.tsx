"use client";

import React from "react";
import dynamic from "next/dynamic";

const OnboardingModal = dynamic(
  () => import("@/components/ui/OnboardingModal").then((m) => m.OnboardingModal),
  { ssr: false }
);

export function OnboardingWrapper() {
  return <OnboardingModal />;
}
