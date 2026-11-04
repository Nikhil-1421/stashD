import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 8

export const emailSchema = z
  .string({ message: 'Enter a valid email address.' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Enter a valid email address.' }))

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { message: `Use at least ${PASSWORD_MIN_LENGTH} characters.` })
  .max(72, { message: 'Use at most 72 characters.' })

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'Enter your password.' }),
})

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export type FieldErrors<T extends Record<string, unknown>> = Partial<Record<keyof T, string>>

/** Flatten a zod error into one message per field (first issue wins). */
export function fieldErrors<T extends Record<string, unknown>>(error: z.ZodError): FieldErrors<T> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '')
    if (key && !(key in out)) out[key] = issue.message
  }
  return out as FieldErrors<T>
}
