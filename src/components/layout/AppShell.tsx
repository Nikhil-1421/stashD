import { Outlet, useNavigation } from 'react-router'
import { useLocalStorageState } from '@/hooks/useLocalStorageState'
import { cn } from '@/lib/utils'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'

/** Desktop: collapsible sidebar + top bar. Mobile: top bar + bottom nav. */
export function AppShell() {
  const [collapsed, setCollapsed] = useLocalStorageState('ui.sidebar.collapsed', false, isBoolean)
  const navigation = useNavigation()
  const loading = navigation.state === 'loading'

  return (
    <div className="flex min-h-dvh">
      {/* Thin bar while a lazy route module (or its data) is loading; the current page stays visible. */}
      <div aria-hidden={!loading} className={cn('fixed inset-x-0 top-0 z-50 h-0.5 bg-accent transition-opacity motion-reduce:transition-none', loading ? 'animate-pulse opacity-100' : 'opacity-0')} />
      {loading ? <span role="status" className="sr-only">Loading page</span> : null}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface-3 focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main" className="flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
