import { useState, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface GlowCardProps {
  children: ReactNode
  className?: string
  glowColor?: string
}

export default function GlowCard({ children, className, glowColor = 'rgba(59,130,196,0.15)' }: GlowCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [hovering, setHovering] = useState(false)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={cn(
        'relative rounded-xl border border-surface-border bg-surface-raised overflow-hidden transition-colors duration-300',
        'hover:border-surface-border-hover',
        className
      )}
    >
      {hovering && (
        <div
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, ${glowColor}, transparent 60%)`,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
