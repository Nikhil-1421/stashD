import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { deleteAccount } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-context'
import { canConfirmDeletion } from './deletion'

export const ACCOUNT_DELETED_NOTICE = 'Your account and all of its data have been deleted.'

/**
 * Two-step, typed confirmation. Deletion is irreversible: the auth user is removed server-side and
 * every owned row cascades (profile today; sets, collections, binders, shares later).
 */
export function DeleteAccountCard() {
  const auth = useAuth()
  const navigate = useNavigate()
  const email = auth.user?.email
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const confirmed = canConfirmDeletion(typed, email)

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await deleteAccount()
      if (!result.ok) throw new Error(result.error)
    },
    onSuccess: () => {
      void navigate('/login', { replace: true, state: { notice: ACCOUNT_DELETED_NOTICE } })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!confirmed || mutation.isPending) return
    mutation.mutate()
  }

  return (
    <Card className="border-danger/30">
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>
          Permanently removes your account, profile, and every set, collection, binder and share you own. This cannot be undone and
          there is no grace period.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!open ? (
          <Button variant="danger" onClick={() => setOpen(true)}>
            Delete my account…
          </Button>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <FormField id="delete-confirm" label={`Type ${email ?? 'your email'} to confirm`} hint="Case does not matter.">
              <Input
                id="delete-confirm"
                type="email"
                autoComplete="off"
                spellCheck={false}
                value={typed}
                aria-describedby="delete-confirm-hint"
                onChange={(e) => setTyped(e.target.value)}
              />
            </FormField>
            {mutation.isError ? <Alert tone="danger" title="Deletion failed">{mutation.error.message}</Alert> : null}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="danger" disabled={!confirmed} loading={mutation.isPending}>
                Permanently delete account
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={mutation.isPending}
                onClick={() => {
                  setOpen(false)
                  setTyped('')
                  mutation.reset()
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
