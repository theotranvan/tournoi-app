"use client";

import { Suspense } from "react";
import PricingSection from "@/components/ui/pricing-section";

export default function PricingPage() {
  return (
    <div className="w-full">
      <Suspense fallback={null}>
        <PricingSection />
      </Suspense>
    </div>
  );
}
