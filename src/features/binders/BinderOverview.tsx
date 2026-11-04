import { cn } from '@/lib/utils'
import type { BinderPage } from './api'
import { useDragSource, useDropTarget } from './dnd'
import { slotCount } from './domain/layout'
import type { PlacementMap } from './domain/placements'

type Props = { pages: readonly BinderPage[]; placements: PlacementMap; currentPageId: string | null; disabled: boolean; onOpen: (pageId: string) => void }

/** Every page as a thumbnail: click to open, drag a thumbnail onto another to reorder, drop a card onto one to place it there. */
export function BinderOverview({ pages, placements, currentPageId, disabled, onOpen }: Props) {
  if (pages.length === 0) return <p className="py-10 text-center text-sm text-fg-muted">No pages yet.</p>
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3" aria-label="Page overview">
      {pages.map((page, i) => (
        <li key={page.id}>
          <PageThumbnail page={page} index={i} placements={placements} current={page.id === currentPageId} disabled={disabled} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  )
}

function PageThumbnail({ page, index, placements, current, disabled, onOpen }: { page: BinderPage; index: number; placements: PlacementMap; current: boolean; disabled: boolean; onOpen: (pageId: string) => void }) {
  const { dragRef, isDragging } = useDragSource(`page:${page.id}`, { kind: 'page', pageId: page.id }, disabled)
  const { dropRef, isDropTarget } = useDropTarget(`page-drop:${page.id}`, { kind: 'page', pageId: page.id }, ['printing', 'slot', 'page'], disabled)
  const count = slotCount(page)
  let filled = 0
  for (let s = 0; s < count; s += 1) if (placements.has(`${page.id}:${s}`)) filled += 1
  return (
    <button
      ref={(el) => {
        dragRef(el)
        dropRef(el)
      }}
      type="button"
      onClick={() => onOpen(page.id)}
      aria-label={`Open page ${index + 1}${page.label ? ` (${page.label})` : ''}, ${filled} of ${count} slots filled`}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'w-full rounded-md border bg-surface-1 p-2 text-left transition-colors hover:border-line-strong',
        current ? 'border-accent' : 'border-line',
        isDropTarget && 'border-accent bg-accent-soft',
        isDragging && 'opacity-40',
      )}
    >
      <span aria-hidden="true" className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${page.columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: count }, (_, s) => (
          <span key={s} className={cn('aspect-[5/7] rounded-[2px]', placements.has(`${page.id}:${s}`) ? 'bg-accent/70' : 'bg-surface-3')} />
        ))}
      </span>
      <span className="mt-1.5 block truncate font-mono text-[11px] text-fg-muted">
        {index + 1}{page.label ? ` · ${page.label}` : ''} <span className="text-fg-subtle">{filled}/{count}</span>
      </span>
    </button>
  )
}
