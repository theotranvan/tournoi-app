"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import PricingSection from "@/components/ui/pricing-section";

export default function PricingPage() {
  const router = useRouter();

  return (
    <div className="w-full">
      <div className="px-4 pt-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="size-4 mr-1" />
          Retour
        </Button>
      </div>
      <PricingSection />
    </div>
  );
}
