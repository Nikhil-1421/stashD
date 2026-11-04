import { Skeleton } from '@/components/ui/Skeleton'
import type { Completion } from './domain/completion'

/** Compact completion summary for a tracked set: bar + owned/required + extras. */
export function CollectionProgress({ completion, pending }: { completion: Completion; pending: boolean }) {
  if (pending) return <Skeleton className="h-16 w-full" />
  const { required, owned, missing, extra, totalQuantity, percent } = completion
  return (
    <section aria-labelledby="progress-heading" className="rounded-lg border border-line bg-surface-1 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="progress-heading" className="text-lg font-light text-fg">Progress</h2>
        <p className="font-mono text-sm text-fg-muted">
          <span className="text-fg">{owned}</span> / {required} required · {percent}%
        </p>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Completion" className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-fg-subtle">
        {required === 0 ? 'Nothing is required yet. Add cards, or mark variants as counting toward completion.' : `${missing} missing`}
        {extra > 0 ? ` · ${extra} owned outside the requirements` : ''}
        {totalQuantity > 0 ? ` · ${totalQuantity} total copies` : ''}
      </p>
    </section>
  )
}
