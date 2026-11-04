import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useMemo, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField } from '@/components/ui/FormField'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/features/auth/auth-context'
import { cardKeys, listVariants } from '@/features/cards/api'
import { useEntitlements } from '@/features/entitlements/context'
import { getUserSet, setDisplayName, setKeys } from '@/features/sets/api'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/utils'
import { importChecklist, listCardKeys, type ImportSource } from './api'
import { parseDelimited } from './domain/delimited'
import { parseJsonRows } from './domain/json'
import { applyMapping, detectMapping, IMPORT_FIELD_LABELS, IMPORT_FIELDS, IMPORTED_FIELDS, looksLikeHeader, mappingIssues, type ImportField, type MappedRow } from './domain/mapping'
import { parsePaste, PASTE_PATTERN_LABELS, PASTE_PATTERNS, type PastePattern } from './domain/paste'
import { buildImportPlan, CONFLICT_STRATEGIES, planIsCommittable, toImportPayload, type ConflictStrategy, type ImportPlan, type PlannedCard } from './domain/plan'

export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024
const PREVIEW_ROWS = 5
const REVIEW_ROWS = 50

type Step = 'source' | 'map' | 'review'
type SourceKind = 'paste' | 'file'
type LoadedFile = { name: string; source: Exclude<ImportSource, 'paste'>; headers: string[] | null; rows: string[][] }

/** `/sets/:userSetId/import` — paste or upload a checklist, map columns, review, commit. */
export function ImportPage() {
  const { userSetId = '' } = useParams()
  const auth = useAuth()
  const { can } = useEntitlements()
  const set = useQuery({ queryKey: setKeys.detail(userSetId), queryFn: () => getUserSet(userSetId) })
  useDocumentTitle(set.data ? `Import into ${setDisplayName(set.data)}` : 'Import checklist')

  if (set.isPending) return <Skeleton className="h-64 w-full" />
  if (set.isError) return <Alert tone="danger" title="Could not load the set">{set.error.message}</Alert>
  if (!set.data) return <Alert tone="warning" title="Set not found">It may have been deleted, or the link is wrong.</Alert>
  const isOwner = set.data.set_owner_id !== null && set.data.set_owner_id === auth.user?.id
  if (!isOwner) return <Alert tone="info" title="Shared catalog set">Only custom sets accept imports. Create a custom set first.</Alert>
  if (!can('sets.import')) return <Alert tone="info" title="Import is not available on your plan">Your current plan does not include checklist import.</Alert>

  return <ImportWizard userSetId={userSetId} catalogSetId={set.data.catalog_set_id} setName={setDisplayName(set.data)} />
}

function ImportWizard({ userSetId, catalogSetId, setName }: { userSetId: string; catalogSetId: string; setName: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('source')
  const [kind, setKind] = useState<SourceKind>('paste')
  const [pasteText, setPasteText] = useState('')
  const [pattern, setPattern] = useState<PastePattern>('auto')
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [hasHeader, setHasHeader] = useState(true)
  const [mapping, setMapping] = useState<ImportField[]>([])
  const [strategy, setStrategy] = useState<ConflictStrategy>('skip')

  const debouncedPaste = useDebouncedValue(pasteText, 200)
  const pasteLines = useMemo(() => (kind === 'paste' ? parsePaste(debouncedPaste, pattern) : []), [kind, debouncedPaste, pattern])
  const pasteErrors = pasteLines.filter((l) => l.error !== undefined)

  const rows: MappedRow[] = useMemo(() => {
    if (kind === 'paste') return pasteLines.filter((l) => l.error === undefined)
    if (!file) return []
    const raw = file.headers ? [file.headers, ...file.rows] : file.rows
    return applyMapping(raw, mapping, file.headers ? true : hasHeader)
  }, [kind, pasteLines, file, mapping, hasHeader])

  const source: ImportSource = kind === 'paste' ? 'paste' : (file?.source ?? 'csv')
  const sourceReady = kind === 'paste' ? rows.length > 0 : file !== null && file.rows.length > 0

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    setFile(null)
    setFileError(null)
    if (!picked) return
    if (picked.size > IMPORT_MAX_FILE_BYTES) {
      setFileError('Files over 5 MB are not supported. Split the checklist or remove unused columns.')
      return
    }
    const ext = picked.name.toLowerCase().split('.').pop() ?? ''
    if (ext === 'xlsx' || ext === 'xls') {
      setFileError('Excel workbooks are not supported yet. In Excel choose File → Save As → CSV UTF-8 and upload that.')
      return
    }
    try {
      const text = await picked.text()
      const loaded = loadFile(picked.name, ext, text)
      setFile(loaded)
      const headerGuess = loaded.headers ? true : looksLikeHeader(loaded.rows[0] ?? [])
      setHasHeader(headerGuess)
      setMapping(detectMapping(loaded.headers ?? (headerGuess ? (loaded.rows[0] ?? []) : (loaded.rows[0] ?? []).map((_, i) => `Column ${i + 1}`))))
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Could not read the file.')
    }
  }

  function toggleHeader(next: boolean) {
    setHasHeader(next)
    if (!file || file.headers) return
    setMapping(next ? detectMapping(file.rows[0] ?? []) : (file.rows[0] ?? []).map(() => 'ignore'))
  }

  const stepIndex: Record<Step, number> = { source: 0, map: 1, review: 2 }
  const steps: { key: Step; label: string }[] = kind === 'paste'
    ? [{ key: 'source', label: 'Paste' }, { key: 'review', label: 'Review' }]
    : [{ key: 'source', label: 'File' }, { key: 'map', label: 'Map columns' }, { key: 'review', label: 'Review' }]

  return (
    <>
      <PageHeader title="Import checklist" description={`Into ${setName}. Nothing is saved until you confirm on the review step.`} actions={<Link to={`/sets/${userSetId}`} className="text-sm text-fg-muted hover:text-fg">Back to set</Link>} />
      <ol className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Import steps">
        {steps.map((s, i) => (
          <li key={s.key} aria-current={step === s.key ? 'step' : undefined} className={cn('rounded-full border px-3 py-1', step === s.key ? 'border-accent text-fg' : stepIndex[s.key] < stepIndex[step] ? 'border-line text-fg-muted' : 'border-line text-fg-subtle')}>
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      {step === 'source' ? (
        <div className="space-y-6">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Source</legend>
            {(['paste', 'file'] as const).map((k) => (
              <label key={k} className={cn('cursor-pointer rounded-md border px-3 py-1.5 text-sm', kind === k ? 'border-accent bg-surface-2 text-fg' : 'border-line text-fg-muted hover:text-fg')}>
                <input type="radio" name="source-kind" value={k} className="sr-only" checked={kind === k} onChange={() => setKind(k)} />
                {k === 'paste' ? 'Paste text' : 'Upload a file'}
              </label>
            ))}
          </fieldset>

          {kind === 'paste' ? (
            <PasteSource text={pasteText} pattern={pattern} parsedCount={rows.length} errorCount={pasteErrors.length} onText={setPasteText} onPattern={setPattern} />
          ) : (
            <FileSource file={file} error={fileError} onChange={(e) => void onFileChange(e)} />
          )}

          <div className="flex justify-end">
            <Button disabled={!sourceReady} onClick={() => setStep(kind === 'paste' ? 'review' : 'map')}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'map' && file ? (
        <MapStep file={file} hasHeader={hasHeader} mapping={mapping} onHeader={toggleHeader} onMapping={setMapping} onBack={() => setStep('source')} onNext={() => setStep('review')} />
      ) : null}

      {step === 'review' ? (
        <ReviewStep
          catalogSetId={catalogSetId}
          rows={rows}
          unparsed={pasteErrors.map((l) => ({ line: l.line, message: l.error ?? '' }))}
          strategy={strategy}
          onStrategy={setStrategy}
          onBack={() => setStep(kind === 'paste' ? 'source' : 'map')}
          onCommit={async (plan) => {
            const payload = toImportPayload(plan)
            const summary = await importChecklist({ setId: catalogSetId, source, strategy, cards: payload.cards, variants: payload.variants })
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: cardKeys.all(catalogSetId) }),
              queryClient.invalidateQueries({ queryKey: cardKeys.variants(catalogSetId) }),
              queryClient.invalidateQueries({ queryKey: ['printings', catalogSetId] }),
              queryClient.invalidateQueries({ queryKey: setKeys.all }),
            ])
            const parts = [
              `${summary.created} added`,
              summary.updated ? `${summary.updated} updated` : null,
              summary.skipped ? `${summary.skipped} skipped` : null,
              summary.variants ? `${summary.variants} new ${summary.variants === 1 ? 'variant' : 'variants'}` : null,
              summary.printings ? `${summary.printings} ${summary.printings === 1 ? 'printing' : 'printings'}` : null,
            ].filter(Boolean)
            void navigate(`/sets/${userSetId}`, { replace: true, state: { notice: `Import complete: ${parts.join(', ')}.` } })
          }}
        />
      ) : null}
    </>
  )
}

function loadFile(name: string, ext: string, text: string): LoadedFile {
  if (ext === 'json') {
    const { headers, rows } = parseJsonRows(text)
    if (rows.length === 0) throw new Error('The JSON file has no card objects.')
    return { name, source: 'json', headers, rows }
  }
  const { delimiter, rows } = parseDelimited(text, ext === 'tsv' ? '\t' : 'auto')
  if (rows.length === 0) throw new Error('The file is empty.')
  return { name, source: delimiter === '\t' ? 'tsv' : 'csv', headers: null, rows }
}

function PasteSource({ text, pattern, parsedCount, errorCount, onText, onPattern }: { text: string; pattern: PastePattern; parsedCount: number; errorCount: number; onText: (v: string) => void; onPattern: (p: PastePattern) => void }) {
  const textId = useId()
  const patternId = useId()
  const example = PASTE_PATTERN_LABELS[pattern].example || PASTE_PATTERN_LABELS['number-dash-name'].example
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
      <FormField id={textId} label="Checklist text" hint="One card per line. A trailing variant becomes a printing of that card.">
        <Textarea id={textId} rows={12} className="font-mono text-sm" placeholder={example} value={text} onChange={(e) => onText(e.target.value)} spellCheck={false} />
      </FormField>
      <div className="space-y-4">
        <FormField id={patternId} label="Line format">
          <Select id={patternId} value={pattern} onChange={(e) => onPattern(e.target.value as PastePattern)}>
            {PASTE_PATTERNS.map((p) => (
              <option key={p} value={p}>{PASTE_PATTERN_LABELS[p].label}</option>
            ))}
          </Select>
        </FormField>
        <p className="text-sm text-fg-muted" role="status">
          {text.trim() === '' ? 'Waiting for text.' : `${parsedCount} ${parsedCount === 1 ? 'line' : 'lines'} recognised${errorCount ? `, ${errorCount} not understood` : ''}.`}
        </p>
      </div>
    </div>
  )
}

function FileSource({ file, error, onChange }: { file: LoadedFile | null; error: string | null; onChange: (e: ChangeEvent<HTMLInputElement>) => void }) {
  const id = useId()
  return (
    <div className="space-y-3">
      <FormField id={id} label="Checklist file" hint="CSV, TSV or JSON up to 5 MB. Excel: save as CSV first.">
        <input id={id} type="file" accept=".csv,.tsv,.txt,.json,text/csv,text/tab-separated-values,application/json" onChange={onChange} className="block w-full text-sm text-fg-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-fg hover:file:border-line-strong" />
      </FormField>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {file ? (
        <p className="text-sm text-fg-muted" role="status">
          Loaded <span className="text-fg">{file.name}</span>: {file.rows.length} {file.rows.length === 1 ? 'row' : 'rows'}, {(file.headers ?? file.rows[0] ?? []).length} columns ({file.source.toUpperCase()}).
        </p>
      ) : null}
    </div>
  )
}

function MapStep({ file, hasHeader, mapping, onHeader, onMapping, onBack, onNext }: { file: LoadedFile; hasHeader: boolean; mapping: ImportField[]; onHeader: (v: boolean) => void; onMapping: (m: ImportField[]) => void; onBack: () => void; onNext: () => void }) {
  const headerRow = file.headers ?? (hasHeader ? (file.rows[0] ?? []) : (file.rows[0] ?? []).map((_, i) => `Column ${i + 1}`))
  const sample = (file.headers ? file.rows : hasHeader ? file.rows.slice(1) : file.rows).slice(0, PREVIEW_ROWS)
  const issues = mappingIssues(mapping)
  const headerId = useId()

  function setField(column: number, field: ImportField) {
    onMapping(mapping.map((f, i) => (i === column ? field : f === field && field !== 'ignore' ? 'ignore' : f)))
  }

  return (
    <div className="space-y-6">
      {file.headers === null ? (
        <label className="flex items-center gap-2 text-sm text-fg">
          <input id={headerId} type="checkbox" className="size-4 accent-accent" checked={hasHeader} onChange={(e) => onHeader(e.target.checked)} />
          First row is a header
        </label>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-line scrollbar-thin">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-fg-subtle">
              {headerRow.map((h, column) => (
                <th key={column} scope="col" className="min-w-40 px-3 py-2 font-normal">
                  <span className="mb-1 block truncate normal-case text-fg" title={h}>{h || `Column ${column + 1}`}</span>
                  <Select aria-label={`Field for ${h || `column ${column + 1}`}`} value={mapping[column] ?? 'ignore'} onChange={(e) => setField(column, e.target.value as ImportField)} className="h-8 text-sm">
                    {IMPORT_FIELDS.map((f) => (
                      <option key={f} value={f}>{IMPORT_FIELD_LABELS[f]}{f !== 'ignore' && !IMPORTED_FIELDS.includes(f) ? ' (not imported yet)' : ''}</option>
                    ))}
                  </Select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sample.map((cells, r) => (
              <tr key={r} className="border-t border-line">
                {headerRow.map((_, column) => (
                  <td key={column} className="max-w-60 truncate px-3 py-1.5 text-fg-muted">{cells[column] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-fg-subtle">Quantity, condition and notes columns are recognised but only written once collection tracking lands (phase 4).</p>
      {issues.length ? <Alert tone="warning">{issues.join(' ')}</Alert> : null}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button disabled={issues.length > 0} onClick={onNext}>Review</Button>
      </div>
    </div>
  )
}

function ReviewStep({ catalogSetId, rows, unparsed, strategy, onStrategy, onBack, onCommit }: { catalogSetId: string; rows: MappedRow[]; unparsed: { line: number; message: string }[]; strategy: ConflictStrategy; onStrategy: (s: ConflictStrategy) => void; onBack: () => void; onCommit: (plan: ImportPlan) => Promise<void> }) {
  const existing = useQuery({ queryKey: [...cardKeys.all(catalogSetId), 'keys'], queryFn: () => listCardKeys(catalogSetId) })
  const variants = useQuery({ queryKey: cardKeys.variants(catalogSetId), queryFn: () => listVariants(catalogSetId) })
  const plan = useMemo(
    () => (existing.data && variants.data ? buildImportPlan(rows, existing.data, variants.data) : null),
    [rows, existing.data, variants.data],
  )
  const commit = useMutation({ mutationFn: (p: ImportPlan) => onCommit(p) })

  if (existing.isPending || variants.isPending) return <Skeleton className="h-48 w-full" />
  if (existing.isError) return <Alert tone="danger" title="Could not load existing cards">{existing.error.message}</Alert>
  if (variants.isError) return <Alert tone="danger" title="Could not load variants">{variants.error.message}</Alert>
  if (!plan) return null

  const { counts } = plan
  const blocking = plan.issues.filter((i) => i.line === 0)
  const committable = planIsCommittable(plan)

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="New cards" value={counts.newCards} />
        <Stat label="Matches existing" value={counts.existingCards} />
        <Stat label="Named printings" value={counts.printings} />
        <Stat label="Problems" value={counts.invalid + unparsed.length} tone={counts.invalid + unparsed.length ? 'warning' : undefined} />
      </dl>

      {blocking.map((i) => <Alert key={i.message} tone="danger">{i.message}</Alert>)}

      {plan.newVariants.length ? (
        <Alert tone="info" title={`${plan.newVariants.length} new ${plan.newVariants.length === 1 ? 'variant' : 'variants'} will be created`}>
          {plan.newVariants.map((v) => v.name).join(', ')}. They are added as non-default, so existing cards are not changed.
        </Alert>
      ) : null}

      {counts.existingCards > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{counts.existingCards} {counts.existingCards === 1 ? 'row matches a card' : 'rows match cards'} already in the set</CardTitle>
            <CardDescription>Choose what happens to them. Ownership and notes are never touched by an import.</CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset className="space-y-2">
              <legend className="sr-only">Conflict strategy</legend>
              {CONFLICT_STRATEGIES.map((s) => (
                <label key={s.value} className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 text-sm has-checked:border-accent">
                  <input type="radio" name="strategy" value={s.value} className="mt-0.5 size-4 accent-accent" checked={strategy === s.value} onChange={() => onStrategy(s.value)} />
                  <span>
                    <span className="block font-normal text-fg">{s.label}</span>
                    <span className="block text-fg-muted">{s.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </CardContent>
        </Card>
      ) : null}

      {counts.invalid + unparsed.length + counts.duplicates > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Rows that will not be imported as written</CardTitle>
            <CardDescription>Fix them in the source and re-import, or continue without them.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm scrollbar-thin">
              {[...unparsed, ...plan.issues.filter((i) => i.line > 0), ...plan.duplicateLines]
                .sort((a, b) => a.line - b.line)
                .slice(0, 100)
                .map((i, idx) => (
                  <li key={`${i.line}-${idx}`} className="text-fg-muted"><span className="font-mono text-xs text-fg-subtle">line {i.line}</span> {i.message}</li>
                ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-line scrollbar-thin">
        <table className="w-full border-collapse text-sm">
          <caption className="px-3 py-2 text-left text-xs text-fg-subtle">
            {plan.cards.length > REVIEW_ROWS ? `First ${REVIEW_ROWS} of ${plan.cards.length} cards` : `${plan.cards.length} ${plan.cards.length === 1 ? 'card' : 'cards'}`}
          </caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-fg-subtle">
              <th scope="col" className="w-24 px-3 py-2 font-normal">#</th>
              <th scope="col" className="px-3 py-2 font-normal">Name</th>
              <th scope="col" className="w-28 px-3 py-2 font-normal">Rarity</th>
              <th scope="col" className="px-3 py-2 font-normal">Printings</th>
              <th scope="col" className="w-36 px-3 py-2 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {plan.cards.slice(0, REVIEW_ROWS).map((c) => (
              <tr key={c.key} className="border-t border-line">
                <td className="px-3 py-1.5 font-mono text-xs text-fg-muted">{c.number ?? '—'}</td>
                <td className="px-3 py-1.5 text-fg">{c.name}</td>
                <td className="px-3 py-1.5 text-fg-muted">{c.rarity ?? ''}</td>
                <td className="px-3 py-1.5 text-fg-muted">{c.variants.length ? c.variants.map((s) => plan.variants.find((v) => v.slug === s)?.name ?? s).join(', ') : 'default'}</td>
                <td className="px-3 py-1.5"><StatusBadge card={c} strategy={strategy} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {commit.isError ? <Alert tone="danger" title="Import failed; nothing was written">{commit.error.message}</Alert> : null}

      <div className="flex items-center justify-between">
        <Button variant="ghost" disabled={commit.isPending} onClick={onBack}>Back</Button>
        <Button loading={commit.isPending} disabled={!committable} onClick={() => commit.mutate(plan)}>
          Import {plan.cards.length} {plan.cards.length === 1 ? 'card' : 'cards'}
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'warning' }) {
  return (
    <div className="rounded-lg border border-line bg-surface-1 px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd className={cn('mt-1 text-xl font-light', tone === 'warning' && value > 0 ? 'text-warning' : 'text-fg')}>{value}</dd>
    </div>
  )
}

function StatusBadge({ card, strategy }: { card: PlannedCard; strategy: ConflictStrategy }) {
  if (card.existingId === null) return <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success">New</span>
  const action = strategy === 'skip' ? 'skip' : strategy === 'update' ? 'update' : 'duplicate'
  return (
    <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs text-fg-muted" title={`Matched by ${card.matchedBy}`}>
      Exists · {action}
    </span>
  )
}
