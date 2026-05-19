import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '../../lib/cn'

interface FadeInProps extends HTMLMotionProps<'div'> {
  delay?: number
  duration?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  children: React.ReactNode
}

const directionOffset = {
  up: { y: 24 },
  down: { y: -24 },
  left: { x: 24 },
  right: { x: -24 },
  none: {},
}

export default function FadeIn({
  delay = 0,
  duration = 0.5,
  direction = 'up',
  children,
  className,
  ...props
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, ...directionOffset[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}
