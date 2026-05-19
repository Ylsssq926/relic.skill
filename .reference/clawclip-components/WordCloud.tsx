import { useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n'

export interface KeywordItem {
  word: string
  count: number
  category: 'tool' | 'topic' | 'model' | 'action' | 'other'
}

export interface WordCloudProps {
  keywords: KeywordItem[]
  onWordClick?: (word: string) => void
  width?: number
  height?: number
}

const CATEGORY_COLORS: Record<KeywordItem['category'], { fill: string; glow: string }> = {
  tool:   { fill: '#60a5fa', glow: 'rgba(96,165,250,0.4)' },
  topic:  { fill: '#06b6d4', glow: 'rgba(6,182,212,0.4)' },
  model:  { fill: '#34d399', glow: 'rgba(52,211,153,0.4)' },
  action: { fill: '#a78bfa', glow: 'rgba(167,139,250,0.4)' },
  other:  { fill: '#94a3b8', glow: 'rgba(148,163,184,0.3)' },
}

type Placed = { word: string; x: number; y: number; fontSize: number; fill: string; glow: string; opacity: number }
type BBox = { left: number; top: number; right: number; bottom: number }

function rectsOverlap(a: BBox, b: BBox): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)
}

export default function WordCloud({ keywords, onWordClick, width = 700, height = 260 }: WordCloudProps) {
  const { t } = useI18n()
  const [hovered, setHovered] = useState<string | null>(null)

  const placed = useMemo(() => {
    if (!keywords.length) return [] as Placed[]
    const sorted = [...keywords].sort((a, b) => b.count - a.count)
    const maxC = sorted[0].count
    const minC = sorted[sorted.length - 1].count
    const range = maxC - minC || 1

    const cx = width / 2, cy = height / 2
    const boxes: BBox[] = []
    const out: Placed[] = []

    for (const kw of sorted) {
      const t = (kw.count - minC) / range
      const fontSize = 14 + t * 38
      const tw = kw.word.length * fontSize * 0.55
      const th = fontSize * 1.2
      const colors = CATEGORY_COLORS[kw.category] ?? CATEGORY_COLORS.other

      let theta = 0
      for (let step = 0; step < 3000; step++) {
        const r = 2.5 * theta
        const x = cx + r * Math.cos(theta)
        const y = cy + r * Math.sin(theta)
        const box: BBox = { left: x - tw/2, top: y - th/2, right: x + tw/2, bottom: y + th/2 }

        if (box.left >= 1 && box.top >= 1 && box.right <= width - 1 && box.bottom <= height - 1) {
          let overlap = false
          for (const b of boxes) { if (rectsOverlap(box, b)) { overlap = true; break } }
          if (!overlap) {
            out.push({ word: kw.word, x, y, fontSize, fill: colors.fill, glow: colors.glow, opacity: 0.5 + t * 0.5 })
            boxes.push(box)
            break
          }
        }
        theta += 0.18
      }
    }
    return out
  }, [keywords, width, height])

  if (!keywords.length) {
    return <div className="flex items-center justify-center min-h-[200px] text-sm text-slate-600">{t('app.wordcloud.empty')}</div>
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto select-none"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="word-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {placed.map((p, i) => {
        const isHovered = hovered === p.word
        return (
          <text
            key={`${p.word}-${i}`}
            x={p.x}
            y={p.y}
            fontSize={isHovered ? p.fontSize * 1.1 : p.fontSize}
            fill={p.fill}
            opacity={isHovered ? 1 : hovered ? 0.15 : p.opacity}
            textAnchor="middle"
            dominantBaseline="middle"
            fontWeight={p.fontSize > 30 ? 700 : p.fontSize > 20 ? 600 : 400}
            filter={isHovered || p.fontSize > 35 ? 'url(#word-glow)' : undefined}
            className="cursor-pointer"
            style={{
              transition: 'opacity 0.2s, font-size 0.2s',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
            onMouseEnter={() => setHovered(p.word)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onWordClick?.(p.word)}
          >
            {p.word}
          </text>
        )
      })}
    </svg>
  )
}
