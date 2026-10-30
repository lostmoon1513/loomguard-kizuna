/**
 * SkeletonCard component for accessible loading states per Step P7.
 * Provides visually distinct pulse placeholders preserving layout geometry
 * to avoid layout shifts (CLS) while remote queries execute.
 */
export default function SkeletonCard({ type = 'draft', count = 1 }) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (type === 'issue') {
    return (
      <div className="space-y-3" role="status" aria-label="Loading findings...">
        {items.map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-slate-200" />
                <div className="h-5 w-20 rounded-md bg-slate-200" />
                <div className="h-5 w-16 rounded-md bg-slate-200" />
              </div>
              <div className="h-5 w-14 rounded-md bg-slate-200" />
            </div>
            <div className="h-4 w-5/6 rounded-md bg-slate-200 mb-2" />
            <div className="h-4 w-3/4 rounded-md bg-slate-100 mb-3" />
            <div className="h-14 w-full rounded-xl bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'row') {
    return (
      <div className="space-y-2" role="status" aria-label="Loading queue rows...">
        {items.map((i) => (
          <div
            key={i}
            className="animate-pulse flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4"
          >
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-1/3 rounded-md bg-slate-200" />
              <div className="h-3 w-1/4 rounded-md bg-slate-100" />
            </div>
            <div className="h-6 w-20 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  // Default: Draft inspection skeleton
  return (
    <div
      role="status"
      aria-label="Loading draft content..."
      className="animate-pulse rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-lg bg-slate-200" />
          <div className="h-3 w-32 rounded-md bg-slate-100" />
        </div>
        <div className="h-7 w-24 rounded-full bg-slate-200" />
      </div>
      <div className="h-48 w-full rounded-2xl bg-slate-100" />
      <div className="flex gap-2">
        <div className="h-8 w-28 rounded-xl bg-slate-200" />
        <div className="h-8 w-28 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
