import { Satellite } from 'lucide-react'

import { cn } from '@/lib/utils'

const variantStyles = {
  nav: {
    box: 'h-10 w-10 rounded-xl',
    icon: 'h-5 w-5',
    text: 'text-xl',
  },
  footer: {
    box: 'h-8 w-8 rounded-lg',
    icon: 'h-4 w-4',
    text: 'text-base',
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
      className={cn('flex items-baseline gap-3 leading-none', className)}
    >
      <div
        className={cn(
          'shrink-0 bg-primary/10 flex items-center justify-center self-center',
          v.box
        )}
      >
        <Satellite className={cn('text-primary', v.icon)} aria-hidden />
      </div>
      <span className={cn('flex flex-wrap items-baseline gap-x-1', v.text)}>
        <span className="font-black tracking-tight text-foreground">Agro</span>
        <span className="font-display font-normal italic tracking-tight text-primary">
          Protect
        </span>
      </span>
    </div>
  )
}
