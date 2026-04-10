"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export interface StepperStep {
  value: string;
  label: string;
  shortLabel?: string;
  enabled: boolean;
  completed: boolean;
  disabledReason?: string;
}

export function TournamentStepper({
  steps,
  currentStep,
  onStepClick,
}: {
  steps: StepperStep[];
  currentStep: string;
  onStepClick: (value: string) => void;
}) {
  const currentIdx = steps.findIndex((s) => s.value === currentStep);

  return (
    <>
      {/* Desktop stepper */}
      <div className="hidden sm:flex items-center gap-0 w-full">
        {steps.map((step, i) => {
          const isCurrent = step.value === currentStep;
          const isPast = step.completed;

          return (
            <div key={step.value} className="flex items-center flex-1 last:flex-none">
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => step.enabled && onStepClick(step.value)}
                  disabled={!step.enabled}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                    isCurrent && "bg-primary text-primary-foreground shadow-sm",
                    isPast && !isCurrent && "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
                    !isCurrent && !isPast && step.enabled && "bg-muted text-muted-foreground hover:bg-muted/80",
                    !step.enabled && "bg-muted/50 text-muted-foreground/40 cursor-not-allowed",
                  )}
                >
                  {isPast && !isCurrent ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <span className={cn(
                      "size-4 rounded-full flex items-center justify-center text-[10px] font-bold border",
                      isCurrent && "border-primary-foreground/30 text-primary-foreground",
                      !isCurrent && "border-current",
                    )}>
                      {i + 1}
                    </span>
                  )}
                  {step.label}
                </button>
                {/* Tooltip for disabled steps */}
                {!step.enabled && step.disabledReason && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-foreground text-background text-[11px] rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {step.disabledReason}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                  </div>
                )}
              </div>
              {i < steps.length - 1 && (
                <div className={cn(
                  "flex-1 h-px mx-1.5 min-w-[12px]",
                  isPast ? "bg-green-300 dark:bg-green-800" : "bg-border",
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile compact indicator */}
      <div className="sm:hidden flex items-center justify-between bg-muted rounded-lg px-3 py-2">
        <span className="text-xs text-muted-foreground font-medium">
          Étape {currentIdx + 1}/{steps.length}
        </span>
        <span className="text-xs font-semibold">
          {steps[currentIdx]?.label ?? ""}
        </span>
        <div className="flex gap-1">
          {steps.map((step, i) => (
            <button
              key={step.value}
              type="button"
              onClick={() => step.enabled && onStepClick(step.value)}
              disabled={!step.enabled}
              className={cn(
                "size-2 rounded-full transition-all",
                step.value === currentStep && "bg-primary scale-125",
                step.completed && step.value !== currentStep && "bg-green-500",
                !step.completed && step.value !== currentStep && step.enabled && "bg-muted-foreground/30",
                !step.enabled && "bg-muted-foreground/15",
              )}
            />
          ))}
        </div>
      </div>
    </>
  );
}
