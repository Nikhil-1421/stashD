/** The user must type their own email (case/whitespace-insensitive) to enable deletion. */
export function canConfirmDeletion(typed: string, email: string | undefined): boolean {
  if (!email) return false
  return typed.trim().toLowerCase() === email.trim().toLowerCase()
}
