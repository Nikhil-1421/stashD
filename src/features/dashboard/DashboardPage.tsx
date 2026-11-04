import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/ButtonLink'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuth } from '@/features/auth/auth-context'
import { fetchOwnProfile, profileKeys } from '@/features/profile/api'
import { listUserSets, setDisplayName, setKeys } from '@/features/sets/api'
import { SetTile } from '@/features/sets/CollectionsPage'

const ONBOARDING_STEPS = [
  { title: 'Create a set', detail: 'Start a custom checklist: name it, add variants, add cards.', phase: 2, to: '/sets/new' },
  { title: 'Import a checklist', detail: 'CSV, TSV, JSON or pasted text, from the Import button on a set.', phase: 3, to: '/sets' },
  { title: 'Choose what counts as complete', detail: 'On a set, untick the variants you do not collect; progress follows your rules.', phase: 4, to: '/sets' },
  { title: 'Track with Bubble Check', detail: 'Tap through a set and watch progress update instantly.', phase: 5, to: '/bubble-check' },
  { title: 'Plan your binder', detail: 'Lay out pages and keep physical order separate from ownership.', phase: 6, to: null },
] as const

export function DashboardPage() {
  useDocumentTitle('Dashboard')
  const auth = useAuth()
  const userId = auth.user?.id ?? ''
  const profile = useQuery({ queryKey: profileKeys.detail(userId), queryFn: () => fetchOwnProfile(userId), enabled: userId !== '' })
  const sets = useQuery({ queryKey: setKeys.list(), queryFn: listUserSets, enabled: userId !== '' })

  const greetingName = profile.data?.display_name ?? auth.user?.email?.split('@')[0] ?? 'there'
  const setCount = sets.data?.length ?? 0
  const cardCount = (sets.data ?? []).reduce((n, s) => n + s.card_count, 0)
  const ownedQuantity = (sets.data ?? []).reduce((n, s) => n + s.owned_quantity, 0)
  const ownedPrintings = (sets.data ?? []).reduce((n, s) => n + s.owned_printings, 0)
  const printingCount = (sets.data ?? []).reduce((n, s) => n + s.printing_count, 0)
  const recent = (sets.data ?? []).slice(0, 6)

  return (
    <>
      <PageHeader
        title={`Hi, ${greetingName}`}
        description={setCount === 0 ? 'Nothing tracked yet. Here is how the app fits together.' : 'Your collection at a glance.'}
        actions={setCount > 0 ? <ButtonLink to="/sets/new" size="sm">New custom set</ButtonLink> : null}
      />

      <section aria-labelledby="stats-heading" className="mb-6">
        <h2 id="stats-heading" className="sr-only">Collection summary</h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Sets tracked', sets.isPending ? null : String(setCount)],
            ['Catalog cards', sets.isPending ? null : String(cardCount)],
            ['Owned copies', sets.isPending ? null : String(ownedQuantity)],
            ['Printings owned', sets.isPending ? null : `${ownedPrintings} / ${printingCount}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-surface-1 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</dt>
              <dd className="mt-1 font-mono text-2xl text-fg">{value === null ? <Skeleton className="h-7 w-10" /> : value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-fg-subtle">Printings owned counts every printing in your sets; each set page shows completion against your own requirements.</p>
      </section>

      {recent.length > 0 ? (
        <section aria-labelledby="recent-heading" className="mb-6">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="recent-heading" className="text-base font-semibold text-fg">Recently updated sets</h2>
            <Link to="/sets" className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">All sets</Link>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((set) => (
              <li key={set.id}><SetTile set={set} /></li>
            ))}
          </ul>
          <p className="sr-only">{recent.map(setDisplayName).join(', ')}</p>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{setCount === 0 ? 'Getting started' : 'What is next'}</CardTitle>
            <CardDescription>Steps marked with a phase number are not built yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {ONBOARDING_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-3 rounded-md border border-line bg-surface-2 p-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line font-mono text-xs text-fg-muted" aria-hidden="true">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">
                      {step.to ? <Link to={step.to} className="underline-offset-4 hover:underline">{step.title}</Link> : step.title}
                    </p>
                    <p className="text-sm text-fg-muted">{step.detail}</p>
                  </div>
                  {step.to ? (
                    <span className="self-start rounded-sm border border-success/30 bg-success-soft px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-success">Available</span>
                  ) : (
                    <span className="self-start rounded-sm border border-line px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-fg-subtle">Phase {step.phase}</span>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Private by default.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-fg-muted">
              {profile.data?.display_name ? 'Your profile has a display name.' : 'Add a display name so shared pages (later) show something other than your email.'}
            </p>
            <ButtonLink to="/settings" variant="secondary" size="sm">Open settings</ButtonLink>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
