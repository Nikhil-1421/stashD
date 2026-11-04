import type { PrintingDetail } from './api'

/** Short, human label for a printing: `#25 Pikachu · Reverse Holo` (variant only when not the first one). */
export function printingLabel(d: PrintingDetail | undefined): string {
  if (!d) return 'Unknown card'
  const head = d.number ? `#${d.number} ${d.name}` : d.name
  return d.variantPosition === 0 ? head : `${head} · ${d.variantName}`
}

export function slotLabel(index: number, d: PrintingDetail | undefined, filled: boolean): string {
  return `Slot ${index + 1}: ${filled ? printingLabel(d) : 'empty'}`
}
