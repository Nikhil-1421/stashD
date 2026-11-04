import { Link } from 'react-router'
import { APP_NAME } from '@/app/brand'
import dCardUrl from '@/assets/brand/stashd-d-card.svg'
import lockupUrl from '@/assets/brand/stashd-lockup-horizontal-on-dark.svg'
import { cn } from '@/lib/utils'

type Props = {
  /** `lockup`: fanned hand + gold wordmark (never under 160 px wide). `icon`: the gold D card, for tight spots. */
  variant?: 'lockup' | 'icon'
  /** Lockup width in px; the brand minimum is 160. */
  width?: number
  className?: string
  to?: string | null
}

// Lockup artwork is 260.67 × 57.95; keep the ratio so the logo is never stretched.
const LOCKUP_RATIO = 57.95 / 260.67

/** The stashD logo from the brand kit. Uses the artwork files as-is: no retyping, glow or rotation. */
export function BrandMark({ variant = 'lockup', width = 160, className, to = '/' }: Props) {
  const w = Math.max(160, width)
  const image =
    variant === 'lockup' ? (
      <img src={lockupUrl} alt={APP_NAME} width={w} height={Math.round(w * LOCKUP_RATIO)} className="block shrink-0" style={{ width: w, height: 'auto' }} />
    ) : (
      <img src={dCardUrl} alt={APP_NAME} width={32} height={32} className="block size-8 shrink-0" />
    )
  if (to === null) return <span className={cn('inline-flex items-center', className)}>{image}</span>
  return (
    <Link to={to} className={cn('inline-flex items-center', className)} aria-label={`${APP_NAME} home`}>
      {image}
    </Link>
  )
}
