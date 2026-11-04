import { cva } from 'class-variance-authority'

/** Shared button classes so links can look like buttons (ButtonLink) without duplicating styles. */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-normal transition-colors select-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-gold-gradient text-accent-fg hover:brightness-110 active:brightness-95',
        secondary: 'bg-surface-2 text-fg border border-line hover:bg-surface-3 hover:border-line-strong',
        ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        danger: 'bg-danger-soft text-danger border border-danger/30 hover:bg-danger/20',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)
