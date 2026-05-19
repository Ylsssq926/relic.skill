import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface EmptyStateProps {
  title: ReactNode
  description: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  className?: string
}

export default function EmptyState({
  title,
  description,
  hint,
  icon = '✨',
  actions,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_14px_36px_-28px_rgba(15,23,42,0.18)]',
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-2xl ring-1 ring-slate-200">
        <span aria-hidden="true">{icon}</span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>
      {hint && (
        <p className="mx-auto mt-3 max-w-2xl text-xs leading-relaxed text-slate-500">{hint}</p>
      )}
      {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{actions}</div>}
    </div>
  )
}
