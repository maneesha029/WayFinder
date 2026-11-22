import clsx from 'clsx';

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx('inline-block animate-pulse rounded-inset bg-line/70', className)}
    />
  );
}

/** Skeleton itinerary used in the planning state (A6.1, min 600ms deliberate feel). */
export function TimelineSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-16 w-16 shrink-0 rounded-card" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
