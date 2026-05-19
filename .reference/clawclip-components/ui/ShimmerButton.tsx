import { cn } from '../../lib/cn'

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
}

export default function ShimmerButton({ children, className, variant = 'primary', ...props }: ShimmerButtonProps) {
  return (
    <button
      className={cn(
        'relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-lg px-6 py-3 font-medium transition-all duration-300',
        variant === 'primary' && [
          'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
          'hover:shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02]',
          'active:scale-[0.98]',
        ],
        variant === 'secondary' && [
          'bg-surface-overlay text-slate-600 border border-surface-border',
          'hover:bg-surface-border hover:text-slate-800',
          'active:scale-[0.98]',
        ],
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
        className,
      )}
      {...props}
    >
      {variant === 'primary' && (
        <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
      )}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  )
}
