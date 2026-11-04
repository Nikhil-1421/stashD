import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('rounded-lg border border-line bg-surface-1', className)} {...props} />
}

export function CardHeader({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('px-5 pt-5 pb-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentPropsWithoutRef<'h2'>) {
  return <h2 className={cn('text-base font-semibold tracking-tight text-fg', className)} {...props} />
}

export function CardDescription({ className, ...props }: ComponentPropsWithoutRef<'p'>) {
  return <p className={cn('mt-1 text-sm text-fg-muted', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('px-5 pb-5', className)} {...props} />
}
