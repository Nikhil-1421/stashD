import { z } from 'zod'

/**
 * Environment handling.
 *
 * Nothing here throws at import time: a missing Supabase configuration must leave the
 * application able to render a clear "setup required" state instead of a blank page.
 * Only public values (anon key, URLs) are ever read here. The service-role key must
 * never be exposed to the browser bundle.
 */

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

const urlSchema = z.preprocess(emptyToUndefined, z.url().optional())
const anonKeySchema = z.preprocess(emptyToUndefined, z.string().min(20).optional())

type FieldResult = { value: string | undefined; problem: string | null }

function readField(raw: Record<string, unknown>, key: string, schema: z.ZodType<string | undefined>): FieldResult {
  const result = schema.safeParse(raw[key])
  if (result.success) return { value: result.data, problem: null }
  const message = result.error.issues[0]?.message ?? 'Invalid value'
  return { value: undefined, problem: `${key}: ${message}` }
}

export type AppEnv =
  | {
      isSupabaseConfigured: true
      supabaseUrl: string
      supabaseAnonKey: string
      appUrl: string
      problems: readonly string[]
    }
  | {
      isSupabaseConfigured: false
      supabaseUrl: null
      supabaseAnonKey: null
      appUrl: string
      problems: readonly string[]
    }

/**
 * Validate a raw env object (normally `import.meta.env`). Pure, so it is unit-tested.
 * `fallbackAppUrl` is used when VITE_APP_URL is absent (the browser origin at runtime).
 */
export function parseEnv(raw: Record<string, unknown>, fallbackAppUrl = 'http://localhost:5173'): AppEnv {
  const problems: string[] = []

  const urlField = readField(raw, 'VITE_SUPABASE_URL', urlSchema)
  const keyField = readField(raw, 'VITE_SUPABASE_ANON_KEY', anonKeySchema)
  const appUrlField = readField(raw, 'VITE_APP_URL', urlSchema)

  for (const f of [urlField, keyField, appUrlField]) if (f.problem) problems.push(f.problem)

  const url = urlField.value
  let anonKey = keyField.value

  if (!url && !urlField.problem) problems.push('VITE_SUPABASE_URL is not set.')
  if (!anonKey && !keyField.problem) problems.push('VITE_SUPABASE_ANON_KEY is not set.')
  if (anonKey && /service_role/i.test(anonKey)) {
    problems.push('VITE_SUPABASE_ANON_KEY looks like a service-role key. Only the anon key may be used in the browser.')
    anonKey = undefined
  }

  const resolvedAppUrl = (appUrlField.value ?? fallbackAppUrl).replace(/\/+$/, '')

  if (url && anonKey) {
    return {
      isSupabaseConfigured: true,
      supabaseUrl: url.replace(/\/+$/, ''),
      supabaseAnonKey: anonKey,
      appUrl: resolvedAppUrl,
      problems,
    }
  }

  return {
    isSupabaseConfigured: false,
    supabaseUrl: null,
    supabaseAnonKey: null,
    appUrl: resolvedAppUrl,
    problems,
  }
}

const runtimeOrigin =
  typeof window !== 'undefined' && window.location ? window.location.origin : undefined

export const env: AppEnv = parseEnv(import.meta.env, runtimeOrigin)
