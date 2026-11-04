import { LogOut, Search } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { BrandMark } from './BrandMark'
import { Button } from '@/components/ui/Button'
import { signOut } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-context'

export function TopBar() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // "/" focuses the search box unless the user is typing somewhere already.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    const q = term.trim()
    if (q === '') return
    void navigate(`/search?q=${encodeURIComponent(q)}`)
    setTerm('')
    searchRef.current?.blur()
  }
  const signOutMutation = useMutation({
    mutationFn: async () => {
      const result = await signOut()
      if (!result.ok) throw new Error(result.error)
    },
  })

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas/80 px-4 backdrop-blur-md md:h-16 md:px-6">
      <BrandMark variant="icon" className="md:hidden" />
      <form role="search" onSubmit={submitSearch} className="hidden max-w-sm flex-1 md:block">
        <label className="relative block">
          <span className="sr-only">Search sets, binders and cards</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search…  /"
            className="h-9 w-full rounded-md border border-line bg-surface-1 pl-8 pr-3 text-sm text-fg placeholder:text-fg-subtle hover:border-line-strong focus:border-accent"
          />
        </label>
      </form>
      <div className="flex items-center gap-2">
        <Link to="/search" aria-label="Search" title="Search" className="grid size-10 place-items-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg md:hidden">
          <Search className="size-4" aria-hidden="true" />
        </Link>
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
