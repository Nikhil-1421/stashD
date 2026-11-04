import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/layout/PageHeader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuth } from '@/features/auth/auth-context'
import { fetchOwnProfile, profileKeys } from '@/features/profile/api'

const ONBOARDING_STEPS = [
  { title: 'Create or import a set', detail: 'Custom sets, CSV/XLSX/JSON import, or paste a checklist.', phase: 2 },
  { title: 'Choose what counts as complete', detail: 'Pick the variants and printings you actually collect.', phase: 4 },
  { title: 'Track with Bubble Check', detail: 'Tap through a set and watch progress update instantly.', phase: 5 },
  { title: 'Plan your binder', detail: 'Lay out pages, drag cards into slots, keep physical order separate.', phase: 6 },
] as const

/**
 * Dashboard. There is no collection data model yet (phase 2+), so this is the honest empty
 * state: it explains the workflow and offers the one action that works today.
 */
export function DashboardPage() {
  useDocumentTitle('Dashboard')
  const auth = useAuth()
  const userId = auth.user?.id ?? ''
  const profile = useQuery({
    queryKey: profileKeys.detail(userId),
    queryFn: () => fetchOwnProfile(userId),
    enabled: userId !== '',
  })

  const greetingName = profile.data?.display_name ?? auth.user?.email?.split('@')[0] ?? 'there'

  return (
    <>
      <PageHeader title={`Hi, ${greetingName}`} description="Nothing tracked yet. Here is how the app will fit together." />

      <section aria-labelledby="stats-heading" className="mb-6">
        <h2 id="stats-heading" className="sr-only">Collection summary</h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Sets tracked', '0'],
            ['Unique cards', '0'],
            ['Total quantity', '0'],
            ['Completion', '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-surface-1 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</dt>
              <dd className="mt-1 font-mono text-2xl text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Getting started</CardTitle>
            <CardDescription>Each step unlocks in the milestone shown. Collection features are not built yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {ONBOARDING_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-3 rounded-md border border-line bg-surface-2 p-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line font-mono text-xs text-fg-muted" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{step.title}</p>
                    <p className="text-sm text-fg-muted">{step.detail}</p>
                  </div>
                  <span className="self-start rounded-sm border border-line px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
                    Phase {step.phase}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available now</CardTitle>
            <CardDescription>Your account is private and ready.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-fg-muted">
              {profile.data?.display_name
                ? 'Your profile has a display name.'
                : 'Add a display name so shared pages (later) show something other than your email.'}
            </p>
            <Link to="/settings" className="inline-flex h-10 items-center rounded-md border border-line bg-surface-2 px-4 text-sm font-medium text-fg hover:bg-surface-3">
              Open settings
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
