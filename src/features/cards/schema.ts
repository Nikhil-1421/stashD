import { z } from 'zod'
import type { VariantCategory } from '@/lib/supabase/database.types'

export const cardSchema = z.object({
  name: z.string().trim().min(1, { message: 'Give the card a name.' }).max(200, { message: 'Use at most 200 characters.' }),
  number: z.string().trim().max(30, { message: 'Use at most 30 characters.' }),
  rarity: z.string().trim().max(60, { message: 'Use at most 60 characters.' }),
})
export type CardInput = z.infer<typeof cardSchema>
export const EMPTY_CARD_INPUT: CardInput = { name: '', number: '', rarity: '' }

export const VARIANT_CATEGORIES: readonly { value: VariantCategory; label: string }[] = [
  { value: 'finish', label: 'Finish (holo, reverse, non-holo…)' },
  { value: 'edition', label: 'Edition (1st edition, unlimited…)' },
  { value: 'parallel', label: 'Parallel / refractor' },
  { value: 'language', label: 'Language' },
  { value: 'promo', label: 'Promo / stamped' },
  { value: 'rarity', label: 'Rarity tier' },
  { value: 'other', label: 'Other' },
]

export const variantSchema = z.object({
  name: z.string().trim().min(1, { message: 'Give the variant a name.' }).max(60, { message: 'Use at most 60 characters.' }),
  category: z.enum(['finish', 'edition', 'parallel', 'language', 'promo', 'rarity', 'other']),
  appliesByDefault: z.boolean(),
})
export type VariantInput = z.infer<typeof variantSchema>
export const EMPTY_VARIANT_INPUT: VariantInput = { name: '', category: 'finish', appliesByDefault: true }
