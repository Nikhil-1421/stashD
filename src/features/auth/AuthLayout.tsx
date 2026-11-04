import type { ReactNode } from 'react'
import { BrandMark } from '@/components/layout/BrandMark'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <BrandMark className="mb-8 inline-flex" />
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-fg-muted">{subtitle}</p> : null}
        <div className="mt-6 rounded-lg border border-line bg-surface-1 p-5">{children}</div>
        {footer ? <div className="mt-5 text-center text-sm text-fg-muted">{footer}</div> : null}
      </div>
    </main>
  )
}
