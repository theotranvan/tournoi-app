import { Skeleton } from "@/components/ui/skeleton";

export default function PublicTournamentLoading() {
  return (
    <div className="p-4 space-y-4">
      {/* Tournament header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-56 rounded-lg" />
        <Skeleton className="h-4 w-40 rounded" />
        <div className="flex gap-1.5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-5 w-12 rounded-full" />
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Skeleton className="h-10 w-full rounded-lg" />

      {/* Match cards */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
