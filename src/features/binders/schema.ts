import { z } from 'zod'
import { MAX_DIMENSION, MIN_DIMENSION } from './domain/layout'

const dimension = z.number().int().min(MIN_DIMENSION).max(MAX_DIMENSION, { message: `Use ${MIN_DIMENSION} to ${MAX_DIMENSION}.` })

export const binderSchema = z.object({
  name: z.string().trim().min(1, { message: 'Give the binder a name.' }).max(120, { message: 'Use at most 120 characters.' }),
  description: z.string().trim().max(2000, { message: 'Use at most 2000 characters.' }),
  gameId: z.union([z.uuid(), z.literal('')]),
  rows: dimension,
  columns: dimension,
})
export type BinderFormInput = z.infer<typeof binderSchema>

export const EMPTY_BINDER_INPUT: BinderFormInput = { name: '', description: '', gameId: '', rows: 3, columns: 3 }
