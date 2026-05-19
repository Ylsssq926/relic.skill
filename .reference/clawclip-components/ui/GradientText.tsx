import { cn } from '../../lib/cn'

interface GradientTextProps {
  children: React.ReactNode
  className?: string
  from?: string
  via?: string
  to?: string
  animate?: boolean
}

export default function GradientText({
  children,
  className,
  from = '#3b82c4',
  via = '#60a5fa',
  to = '#93c5fd',
  animate = false,
}: GradientTextProps) {
  return (
    <span
      className={cn(
        'bg-clip-text text-transparent',
        animate && 'animate-gradient-shift bg-[length:200%_200%]',
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, ${from}, ${via}, ${to})`,
      }}
    >
      {children}
    </span>
  )
}
