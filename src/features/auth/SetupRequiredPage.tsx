import { env } from '@/lib/env'
import { Alert } from '@/components/ui/Alert'
import { AuthLayout } from './AuthLayout'

/** Rendered instead of auth or app screens when Supabase env vars are missing or invalid. */
export function SetupRequiredPage() {
  return (
    <AuthLayout title="Setup required" subtitle="This build has no Supabase configuration, so sign-in and data storage are unavailable.">
      <div className="space-y-4 text-sm">
        <Alert tone="warning" title="Environment problems">
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {env.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
        <ol className="list-decimal space-y-2 pl-5 text-fg-muted">
          <li>
            Copy <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-fg">.env.example</code> to{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-fg">.env.local</code>.
          </li>
          <li>Fill in the project URL and anon key from the Supabase dashboard (or from `npm run db:start`).</li>
          <li>Restart the dev server.</li>
        </ol>
        <p className="text-fg-subtle">Full instructions are in the README. Never use the service-role key here.</p>
      </div>
    </AuthLayout>
  )
}
