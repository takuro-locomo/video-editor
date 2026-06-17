'use client'
import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { SubtitleSegment, StyleRun } from '@/types/subtitle'
import { fontFamilyToCss, hexToRgba, wrapText, computeEffectiveMaxChars, mergeStyle } from '@/lib/subtitle-style'

function findActiveSegment(segments: SubtitleSegment[], currentTime: number) {
  return segments.find(
    (seg) => currentTime >= seg.startTime && currentTime <= seg.endTime
  )
}

const POSITION_CLASS = {
  top: 'items-start pt-[5%]',
  middle: 'items-center',
  bottom: 'items-end pb-[8%]',
} as const

/** スタイルランを考慮してテキストを JSX spans に分割して返す */
function renderWithRuns(
  text: string,
  runs: StyleRun[] | undefined,
  baseFontSize: number,
  baseColor: string,
  effectiveMaxChars: number
): React.ReactNode {
  const wrapped = wrapText(text, effectiveMaxChars)

  if (!runs?.length) return wrapped

  // 元テキスト上のランを有効なものだけ取り出してソート
  const validRuns = runs
    .filter((r) => r.from < r.to && r.from >= 0 && r.to <= text.length)
    .sort((a, b) => a.from - b.from)
  if (!validRuns.length) return wrapped

  // 元テキスト→折り返し済みテキストのインデックスマッピング
  const map: number[] = new Array(text.length + 1).fill(wrapped.length)
  let wi = 0
  for (let oi = 0; oi <= text.length; oi++) {
    while (wi < wrapped.length && wrapped[wi] === '\n') wi++
    map[oi] = wi
    if (oi < text.length) wi++
  }

  const wChars = [...wrapped]
  const pieces: { text: string; run?: StyleRun }[] = []
  let pos = 0
  for (const run of validRuns) {
    const wFrom = map[run.from]
    const wTo = map[Math.min(run.to, text.length)]
    if (wFrom > pos) pieces.push({ text: wChars.slice(pos, wFrom).join('') })
    pieces.push({ text: wChars.slice(wFrom, wTo).join(''), run })
    pos = wTo
  }
  if (pos < wChars.length) pieces.push({ text: wChars.slice(pos).join('') })

  return (
    <>
      {pieces.map((p, i) => {
        if (!p.run) return <span key={i}>{p.text}</span>
        const style: React.CSSProperties = {}
        if (p.run.sizeMultiplier) style.fontSize = `${baseFontSize * p.run.sizeMultiplier}px`
        if (p.run.color) style.color = p.run.color
        return <span key={i} style={style}>{p.text}</span>
      })}
    </>
  )
}

export function SubtitleOverlay() {
  const { segments, currentTime, subtitleStyle } = useEditorStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const active = findActiveSegment(segments, currentTime)

  // セグメント個別スタイルをグローバルとマージ
  const s = mergeStyle(subtitleStyle, active?.styleOverride)
  const fontSize = (box.h * s.fontSizePercent) / 100
  const effectiveMaxChars = computeEffectiveMaxChars(box.w, box.h, s.fontSizePercent, s.maxCharsPerLine)

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 flex justify-center px-[4%] pointer-events-none ${POSITION_CLASS[s.position]}`}
    >
      {active && (
        <span
          className="text-center whitespace-pre-wrap leading-tight max-w-full"
          style={{
            fontFamily: fontFamilyToCss(s.fontFamily),
            fontSize: `${fontSize}px`,
            fontWeight: s.bold ? 700 : 400,
            color: s.textColor,
            backgroundColor: s.backgroundEnabled
              ? hexToRgba(s.backgroundColor, s.backgroundOpacity)
              : 'transparent',
            padding: s.backgroundEnabled ? '0.1em 0.4em' : 0,
            borderRadius: s.backgroundEnabled ? '0.2em' : 0,
            textShadow: s.outline
              ? '2px 2px 2px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9), 1px -1px 2px rgba(0,0,0,0.9), -1px 1px 2px rgba(0,0,0,0.9)'
              : 'none',
          }}
        >
          {renderWithRuns(active.text, active.styleRuns, fontSize, s.textColor, effectiveMaxChars)}
        </span>
      )}
    </div>
  )
}
