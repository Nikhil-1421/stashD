import { z } from 'zod'

export const LANGUAGE_OPTIONS = [
  ['en', 'English'],
  ['ja', 'Japanese'],
  ['de', 'German'],
  ['fr', 'French'],
  ['es', 'Spanish'],
  ['it', 'Italian'],
  ['pt', 'Portuguese'],
  ['ko', 'Korean'],
  ['zh', 'Chinese'],
  ['other', 'Other'],
] as const

const optionalText = (max: number) => z.string().trim().max(max, { message: `Use at most ${max} characters.` })

export const customSetSchema = z.object({
  name: z.string().trim().min(1, { message: 'Give the set a name.' }).max(120, { message: 'Use at most 120 characters.' }),
  gameId: z.union([z.uuid(), z.literal('')]),
  setCode: optionalText(20),
  series: optionalText(120),
  releaseDate: z.union([z.literal(''), z.iso.date({ message: 'Use the YYYY-MM-DD format.' })]),
  language: z.string().trim().min(2).max(10),
  description: optionalText(2000),
})
export type CustomSetInput = z.infer<typeof customSetSchema>

export const EMPTY_SET_INPUT: CustomSetInput = {
  name: '',
  gameId: '',
  setCode: '',
  series: '',
  releaseDate: '',
  language: 'en',
  description: '',
}
