interface LegalSectionProps {
  title: string;
  children: React.ReactNode;
}

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="prose prose-sm prose-invert max-w-none text-muted-foreground space-y-2">
        {children}
      </div>
    </section>
  );
}
