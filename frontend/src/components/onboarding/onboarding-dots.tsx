"use client";

interface OnboardingDotsProps {
  total: number;
  current: number;
  onDotClick: (index: number) => void;
}

export function OnboardingDots({
  total,
  current,
  onDotClick,
}: OnboardingDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2" role="tablist">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          role="tab"
          aria-selected={i === current}
          aria-label={`Slide ${i + 1}`}
          onClick={() => onDotClick(i)}
          className="h-2 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={{
            width: i === current ? 32 : 8,
            backgroundColor:
              i === current
                ? "var(--primary)"
                : "color-mix(in srgb, var(--muted-foreground) 30%, transparent)",
          }}
        />
      ))}
    </div>
  );
}
