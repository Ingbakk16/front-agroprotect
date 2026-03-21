import { Loader2Icon } from 'lucide-react'

import { cn } from '@/lib/utils'

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <span className="inline-flex animate-spin" role="status" aria-label="Loading">
      <Loader2Icon className={cn('size-4', className)} {...props} />
    </span>
  )
}

export { Spinner }
