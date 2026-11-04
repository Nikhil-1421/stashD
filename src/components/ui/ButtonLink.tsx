import type { VariantProps } from 'class-variance-authority'
import { Link, type LinkProps } from 'react-router'
import { cn } from '@/lib/utils'
import { buttonVariants } from './button-styles'

export type ButtonLinkProps = LinkProps & VariantProps<typeof buttonVariants>

export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
