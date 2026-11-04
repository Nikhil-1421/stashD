import { NavLink } from 'react-router'
import { NAV_ITEMS } from '@/app/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** Mobile-only index of the sections that do not fit in the bottom bar. */
export function MorePage() {
  useDocumentTitle('More')
  const items = NAV_ITEMS.filter((i) => !i.primary)
  return (
    <>
      <PageHeader title="More" />
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-1">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to}>
              <NavLink to={item.to} className="flex min-h-14 items-center gap-3 px-4 text-sm text-fg hover:bg-surface-2">
                <Icon className="size-5 text-fg-muted" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {item.status === 'planned' ? <span className="text-xs text-fg-subtle">Planned</span> : null}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </>
  )
}
