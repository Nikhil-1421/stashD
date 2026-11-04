import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField } from '@/components/ui/FormField'
import { describedBy } from '@/components/ui/form-utils'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { signOut } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-context'
import { useEntitlements } from '@/features/entitlements/context'
import { fetchOwnProfile, profileKeys, updateOwnProfile } from './api'

const displayNameSchema = z.string().trim().max(80, { message: 'Use at most 80 characters.' })

export function SettingsPage() {
  useDocumentTitle('Settings')
  const auth = useAuth()
  const entitlements = useEntitlements()
  const queryClient = useQueryClient()
  const userId = auth.user?.id ?? ''

  const profileQuery = useQuery({
    queryKey: profileKeys.detail(userId),
    queryFn: () => fetchOwnProfile(userId),
    enabled: userId !== '',
  })

  // `draft` is null until the user edits; the field otherwise shows the loaded value.
  const [draft, setDraft] = useState<string | null>(null)
  const displayName = draft ?? profileQuery.data?.display_name ?? ''
  const [nameError, setNameError] = useState<string | undefined>(undefined)
  const [saved, setSaved] = useState(false)

  const saveMutation = useMutation({
    mutationFn: (name: string) => updateOwnProfile(userId, { display_name: name === '' ? null : name }),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.detail(userId), profile)
      setDraft(null)
      setSaved(true)
    },
  })

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const result = await signOut()
      if (!result.ok) throw new Error(result.error)
    },
  })

  function onSave(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    const parsed = displayNameSchema.safeParse(displayName)
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message)
      return
    }
    setNameError(undefined)
    saveMutation.mutate(parsed.data)
  }

  return (
    <>
      <PageHeader title="Settings" description="Your account and profile." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>How you appear in anything you choose to share later. Private by default.</CardDescription>
          </CardHeader>
          <CardContent>
            {profileQuery.isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : profileQuery.isError ? (
              <Alert tone="danger" title="Could not load your profile">{profileQuery.error.message}</Alert>
            ) : (
              <form onSubmit={onSave} noValidate className="space-y-4">
                <FormField id="display_name" label="Display name" error={nameError} hint="Optional. Up to 80 characters.">
                  <Input
                    id="display_name"
                    value={displayName}
                    maxLength={80}
                    autoComplete="nickname"
                    invalid={Boolean(nameError)}
                    aria-describedby={describedBy('display_name', nameError, 'Optional. Up to 80 characters.')}
                    onChange={(e) => {
                      setSaved(false)
                      setDraft(e.target.value)
                    }}
                  />
                </FormField>
                {saveMutation.isError ? <Alert tone="danger">{saveMutation.error.message}</Alert> : null}
                {saved ? <Alert tone="success">Profile saved.</Alert> : null}
                <div className="flex justify-end">
                  <Button type="submit" loading={saveMutation.isPending}>Save</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Signed in as <span className="text-fg">{auth.user?.email}</span></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-fg-subtle">Plan</dt>
              <dd className="text-fg">{entitlements.planName}</dd>
              <dt className="text-fg-subtle">Email verified</dt>
              <dd className="text-fg">{auth.user?.email_confirmed_at ? 'Yes' : 'No'}</dd>
            </dl>
            {signOutMutation.isError ? <Alert tone="danger">{signOutMutation.error.message}</Alert> : null}
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" loading={signOutMutation.isPending} onClick={() => signOutMutation.mutate()}>
                Sign out
              </Button>
            </div>
            <p className="text-sm text-fg-subtle">
              Account deletion (with confirmation and full data removal) is scheduled for the next milestone. See docs/ROADMAP.md.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
