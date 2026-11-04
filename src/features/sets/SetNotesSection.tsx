import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { InlineConfirm } from '@/components/ui/InlineConfirm'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { addNote, deleteNote, listNotes, noteKeys } from './notes-api'

const MAX = 2000

/** Timestamped free-text notes for one tracked set, newest first (the reference app's Notes sheet). */
export function SetNotesSection({ userSetId }: { userSetId: string }) {
  const queryClient = useQueryClient()
  const notes = useQuery({ queryKey: noteKeys.list(userSetId), queryFn: () => listNotes(userSetId), enabled: userSetId !== '' })
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: noteKeys.list(userSetId) })
  const add = useMutation({ mutationFn: (body: string) => addNote(userSetId, body), onSuccess: async () => { setDraft(''); await invalidate() } })
  const remove = useMutation({ mutationFn: (id: string) => deleteNote(id), onSuccess: invalidate })
  const count = notes.data?.length ?? 0

  function submit(e: FormEvent) {
    e.preventDefault()
    const body = draft.trim().slice(0, MAX)
    if (body === '') return
    add.mutate(body)
  }

  return (
    <section aria-labelledby="notes-heading" className="rounded-lg border border-line bg-surface-1">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-4 text-left">
        <span>
          <span id="notes-heading" className="text-base font-semibold text-fg">Notes</span>
          <span className="ml-2 font-mono text-xs text-fg-subtle">{notes.isPending ? '' : count}</span>
        </span>
        <span className="text-xs text-fg-muted">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? (
        <div className="space-y-4 border-t border-line px-5 py-4">
          <form onSubmit={submit} noValidate aria-label="Add note" className="space-y-2">
            <Textarea aria-label="New note" rows={2} maxLength={MAX} placeholder="Pulled a holo, traded #25 away…" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="flex items-center justify-between">
              <span className="text-xs text-fg-subtle">{draft.length}/{MAX}</span>
              <Button type="submit" size="sm" loading={add.isPending} disabled={draft.trim() === ''}>Add note</Button>
            </div>
          </form>
          {add.isError ? <Alert tone="danger">{add.error.message}</Alert> : null}
          {remove.isError ? <Alert tone="danger">{remove.error.message}</Alert> : null}
          {notes.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : notes.isError ? (
            <Alert tone="danger">{notes.error.message}</Alert>
          ) : count === 0 ? (
            <p className="text-sm text-fg-muted">No notes yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {notes.data.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="whitespace-pre-wrap text-sm text-fg">{n.body}</p>
                    <time dateTime={n.created_at} className="mt-1 block font-mono text-[11px] text-fg-subtle">{formatWhen(n.created_at)}</time>
                  </div>
                  <InlineConfirm label="Delete" confirmLabel="Delete note" variant="ghost" pending={remove.isPending && remove.variables === n.id} onConfirm={() => remove.mutate(n.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
