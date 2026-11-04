import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

const VALID_URL = 'https://abcdefghijkl.supabase.co'
const VALID_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon.signature'

describe('parseEnv', () => {
  it('is configured when both Supabase values are valid', () => {
    const env = parseEnv({ VITE_SUPABASE_URL: VALID_URL, VITE_SUPABASE_ANON_KEY: VALID_KEY })
    expect(env.isSupabaseConfigured).toBe(true)
    if (env.isSupabaseConfigured) {
      expect(env.supabaseUrl).toBe(VALID_URL)
      expect(env.supabaseAnonKey).toBe(VALID_KEY)
    }
    expect(env.problems).toEqual([])
  })

  it('is unconfigured, with specific problems, when values are missing', () => {
    const env = parseEnv({})
    expect(env.isSupabaseConfigured).toBe(false)
    expect(env.problems).toEqual(['VITE_SUPABASE_URL is not set.', 'VITE_SUPABASE_ANON_KEY is not set.'])
  })

  it('treats blank strings as unset', () => {
    const env = parseEnv({ VITE_SUPABASE_URL: '   ', VITE_SUPABASE_ANON_KEY: '' })
    expect(env.isSupabaseConfigured).toBe(false)
    expect(env.problems).toHaveLength(2)
  })

  it('reports an invalid URL and stays unconfigured', () => {
    const env = parseEnv({ VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_ANON_KEY: VALID_KEY })
    expect(env.isSupabaseConfigured).toBe(false)
    expect(env.problems.some((p) => p.startsWith('VITE_SUPABASE_URL'))).toBe(true)
    // The valid key must not be reported as missing.
    expect(env.problems).not.toContain('VITE_SUPABASE_ANON_KEY is not set.')
  })

  it('refuses a key that looks like a service-role key', () => {
    const env = parseEnv({ VITE_SUPABASE_URL: VALID_URL, VITE_SUPABASE_ANON_KEY: 'xxxxxxxxxxxx.service_role.yyyyyyyyyy' })
    expect(env.isSupabaseConfigured).toBe(false)
    expect(env.problems.join(' ')).toMatch(/service-role/)
  })

  it('strips trailing slashes and falls back to the runtime origin for the app URL', () => {
    const env = parseEnv({ VITE_SUPABASE_URL: `${VALID_URL}/`, VITE_SUPABASE_ANON_KEY: VALID_KEY }, 'https://app.example.com/')
    expect(env.appUrl).toBe('https://app.example.com')
    if (env.isSupabaseConfigured) expect(env.supabaseUrl).toBe(VALID_URL)
  })

  it('prefers an explicit VITE_APP_URL', () => {
    const env = parseEnv({ VITE_APP_URL: 'https://collector.example' }, 'http://localhost:5173')
    expect(env.appUrl).toBe('https://collector.example')
  })
})
