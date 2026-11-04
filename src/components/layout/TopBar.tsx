import { LogOut } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { signOut } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-context'

export function TopBar() {
  const auth = useAuth()
  const signOutMutation = useMutation({
    mutationFn: async () => {
      const result = await signOut()
      if (!result.ok) throw new Error(result.error)
    },
  })

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur md:px-6">
      <Link to="/" className="flex items-center gap-2 md:hidden" aria-label="Collector home">
        <span className="grid size-8 place-items-center rounded-md border border-line bg-surface-2" aria-hidden="true">
          <span className="block size-3 rounded-full bg-accent" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-fg">Collector</span>
      </Link>
      <div className="hidden md:block" />
      <div className="flex items-center gap-2">
        <Link to="/settings" className="max-w-[40vw] truncate text-sm text-fg-muted hover:text-fg md:max-w-xs">
          {auth.user?.email ?? 'Account'}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          title="Sign out"
          loading={signOutMutation.isPending}
          onClick={() => signOutMutation.mutate()}
        >
          {!signOutMutation.isPending ? <LogOut className="size-4" aria-hidden="true" /> : null}
        </Button>
      </div>
    </header>
  )
}
