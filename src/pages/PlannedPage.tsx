import { Link, useLocation } from 'react-router'
import { NAV_ITEMS } from '@/app/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** Honest placeholder for a navigation section that is on the roadmap but not implemented. */
export function PlannedPage() {
  const { pathname } = useLocation()
  const item = NAV_ITEMS.find((i) => i.to === pathname)
  const title = item?.label ?? 'Coming soon'
  useDocumentTitle(title)

  return (
    <>
      <PageHeader title={title} />
      <Alert tone="info" title="Not built yet">
        This section is scheduled for roadmap phase {item?.phase ?? '—'}. Nothing here is interactive on purpose; there are no demo
        buttons that pretend to work. See <code className="font-mono text-xs">docs/ROADMAP.md</code>.
      </Alert>
      <p className="mt-4 text-sm">
        <Link to="/" className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">Back to dashboard</Link>
      </p>
    </>
  )
}
