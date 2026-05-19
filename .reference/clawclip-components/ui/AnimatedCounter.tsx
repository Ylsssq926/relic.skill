import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

interface AnimatedCounterProps {
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

export default function AnimatedCounter({
  value,
  duration = 1000,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0)
  const startTime = useRef<number | null>(null)
  const animFrame = useRef<number>(0)

  useEffect(() => {
    const startValue = display
    startTime.current = null

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp
      const progress = Math.min((timestamp - startTime.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(startValue + (value - startValue) * eased)
      if (progress < 1) {
        animFrame.current = requestAnimationFrame(animate)
      }
    }

    animFrame.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animFrame.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  )
}
