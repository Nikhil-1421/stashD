import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router'
import { NAV_ITEMS } from '@/app/navigation'
import { BrandMark } from './BrandMark'
import { cn } from '@/lib/utils'

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      aria-label="Primary"
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface-1 transition-[width] md:flex',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className={cn('flex h-14 items-center border-b border-line', collapsed ? 'justify-center px-0' : 'gap-2 px-4')}>
        <BrandMark showName={!collapsed} to={null} />
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors',
                      isActive ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                      collapsed && 'justify-center px-0',
                    )
                  }
                >
                  <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                  {!collapsed ? (
                    <>
                      <span className="truncate">{item.label}</span>
                      {item.status === 'planned' ? (
                        <span className="ml-auto rounded-sm border border-line px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
                          Planned
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="sr-only">{item.label}</span>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-2">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" aria-hidden="true" /> : <PanelLeftClose className="size-[18px]" aria-hidden="true" />}
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </div>
    </aside>
  )
}
