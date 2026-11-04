import { Ellipsis } from 'lucide-react'
import { NavLink } from 'react-router'
import { NAV_ITEMS } from '@/app/navigation'
import { cn } from '@/lib/utils'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-normal transition-colors',
    isActive ? 'text-fg [&>svg]:text-accent' : 'text-fg-subtle hover:text-fg-muted',
  )

/** Compact bottom bar for small screens; 44px+ touch targets; secondary items live under "More". */
export function MobileNav() {
  const primary = NAV_ITEMS.filter((i) => i.primary)
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-canvas/85 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {primary.map((item) => {
        const Icon = item.icon
        return (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
            <Icon className="size-5" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        )
      })}
      <NavLink to="/more" className={linkClass}>
        <Ellipsis className="size-5" aria-hidden="true" />
        <span>More</span>
      </NavLink>
    </nav>
  )
}
