import { Link } from 'react-router'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Not found')
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-mono text-sm text-fg-subtle">404</p>
      <h1 className="text-xl font-semibold text-fg">Page not found</h1>
      <Link to="/" className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">Back to dashboard</Link>
    </main>
  )
}
