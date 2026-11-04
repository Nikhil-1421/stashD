import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Alert } from '@/components/ui/Alert'

export function RouteErrorPage() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unexpected error'

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4">
        <Alert tone="danger" title="Something went wrong">{message}</Alert>
        <Link to="/" className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">Back to dashboard</Link>
      </div>
    </main>
  )
}
