import { Skeleton } from "@/components/ui/skeleton";

export default function CoachLoading() {
  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-40 rounded-lg" />
        <Skeleton className="h-4 w-56 rounded" />
      </div>

      {/* Match card */}
      <Skeleton className="h-28 rounded-xl" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>

      {/* Content */}
      <Skeleton className="h-16 rounded-xl" />
    </div>
  );
}
