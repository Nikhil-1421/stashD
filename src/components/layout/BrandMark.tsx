import { Link } from 'react-router'
import { APP_NAME } from '@/app/brand'
import { cn } from '@/lib/utils'

/** Logo mark + wordmark. Placeholder glyph until the brand kit is ready. */
export function BrandMark({ showName = true, className, to = '/' }: { showName?: boolean; className?: string; to?: string | null }) {
  const content = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface-2" aria-hidden="true">
        <span className="block size-3 rounded-full bg-accent" />
      </span>
      {showName ? <span className="truncate text-sm font-semibold tracking-tight text-fg">{APP_NAME}</span> : null}
    </>
  )
  if (to === null) return <span className={cn('flex items-center gap-2', className)}>{content}</span>
  return (
    <Link to={to} className={cn('flex items-center gap-2', className)} aria-label={`${APP_NAME} home`}>
      {content}
    </Link>
  )
}
