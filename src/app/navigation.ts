import {
  ArrowLeftRight,
  BookOpen,
  CircleDot,
  Heart,
  LayoutDashboard,
  Library,
  ListChecks,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type NavStatus = 'ready' | 'planned'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  status: NavStatus
  /** Roadmap phase that delivers the section (see docs/ROADMAP.md). */
  phase: number
  /** Shown in the compact mobile bar. */
  primary: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, status: 'ready', phase: 1, primary: true },
  { to: '/sets', label: 'Collections', icon: Library, status: 'ready', phase: 2, primary: true },
  { to: '/binders', label: 'Binders', icon: BookOpen, status: 'planned', phase: 6, primary: true },
  { to: '/bubble-check', label: 'Bubble Check', icon: CircleDot, status: 'planned', phase: 5, primary: true },
  { to: '/wishlist', label: 'Wishlist', icon: Heart, status: 'planned', phase: 8, primary: false },
  { to: '/trade', label: 'Trade', icon: ArrowLeftRight, status: 'planned', phase: 8, primary: false },
  { to: '/checklists', label: 'Checklist Library', icon: ListChecks, status: 'planned', phase: 3, primary: false },
  { to: '/settings', label: 'Settings', icon: Settings, status: 'ready', phase: 1, primary: false },
]
