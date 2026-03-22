import { Satellite } from 'lucide-react'

import { cn } from '@/lib/utils'

const variantStyles = {
  nav: {
    box: 'h-10 w-10 rounded-xl',
    icon: 'h-5 w-5',
    outerGap: 'gap-3',
    wordRow:
      'inline-flex flex-wrap items-baseline gap-x-2 overflow-visible',
    agro:
      'brand-wordmark-agro text-xl font-extrabold leading-snug tracking-tight',
    protect:
      'text-xl font-display font-bold italic leading-snug tracking-tight text-primary',
  },
  footer: {
    box: 'h-8 w-8 rounded-lg',
    icon: 'h-4 w-4',
    outerGap: 'gap-2.5',
    wordRow:
      'inline-flex flex-wrap items-baseline gap-x-1.5 overflow-visible',
    agro:
      'brand-wordmark-agro text-base font-extrabold leading-snug tracking-tight',
    protect:
      'text-base font-display font-bold italic leading-snug tracking-tight text-primary',
  },
} as const

export type BrandWordmarkVariant = keyof typeof variantStyles

interface BrandWordmarkProps {
  variant?: BrandWordmarkVariant
  className?: string
}

export function BrandWordmark({ variant = 'nav', className }: BrandWordmarkProps) {
  const v = variantStyles[variant]

  return (
    <div
      className={cn(
        'flex items-center overflow-visible',
        v.outerGap,
        className
      )}
    >
      <div
        className={cn(
          'shrink-0 bg-primary/10 flex items-center justify-center overflow-visible',
          v.box
        )}
      >
        <Satellite className={cn('text-primary', v.icon)} aria-hidden />
      </div>
      <span className={v.wordRow}>
        <span className={v.agro}>Agro</span>
        <span className={v.protect}>Protect</span>
      </span>
    </div>
  )
}
