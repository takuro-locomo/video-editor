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
  bottom: 'items-end pb-[6%]',
} as const

type Piece = { text: string; run?: StyleRun }

/**
 * スタイルランを考慮してテキストを折り返し、行ごとのスパン配列に分割する。
 * 書き出し(ASS)と同じく行単位で描画するため（背景ボックスを行ごとに独立させる）。
 */
function buildLines(
  text: string,
  runs: StyleRun[] | undefined,
  effectiveMaxChars: number
): Piece[][] {
  const wrapped = wrapText(text, effectiveMaxChars)

  // 元テキスト→折り返し済みテキストのインデックスマッピング
  const validRuns = (runs ?? [])
    .filter((r) => r.from < r.to && r.from >= 0 && r.to <= text.length)
    .sort((a, b) => a.from - b.from)

  const pieces: Piece[] = []
  if (!validRuns.length) {
    pieces.push({ text: wrapped })
  } else {
    const map: number[] = new Array(text.length + 1).fill(wrapped.length)
    let wi = 0
    for (let oi = 0; oi <= text.length; oi++) {
      while (wi < wrapped.length && wrapped[wi] === '\n') wi++
      map[oi] = wi
      if (oi < text.length) wi++
    }
    const wChars = [...wrapped]
    let pos = 0
    for (const run of validRuns) {
      const wFrom = map[run.from]
      const wTo = map[Math.min(run.to, text.length)]
      if (wFrom > pos) pieces.push({ text: wChars.slice(pos, wFrom).join('') })
      pieces.push({ text: wChars.slice(wFrom, wTo).join(''), run })
      pos = wTo
    }
    if (pos < wChars.length) pieces.push({ text: wChars.slice(pos).join('') })
  }

  // 改行で行ごとに分割（ランの装飾は行をまたいでも維持）
  const lines: Piece[][] = [[]]
  for (const p of pieces) {
    const parts = p.text.split('\n')
    parts.forEach((part, i) => {
      if (i > 0) lines.push([])
      if (part) lines[lines.length - 1].push({ text: part, run: p.run })
    })
  }
  return lines.filter((line) => line.length > 0)
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

  const lines = active ? buildLines(active.text, active.styleRuns, effectiveMaxChars) : []

  const oc = s.outlineColor ?? '#000000'
  const shadows: string[] = []
  if (s.outline) {
    shadows.push(
      `2px 2px 2px ${oc}, -2px -2px 2px ${oc}, 2px -2px 2px ${oc}, -2px 2px 2px ${oc}, 0 2px 2px ${oc}, 0 -2px 2px ${oc}, 2px 0 2px ${oc}, -2px 0 2px ${oc}`
    )
  }
  if (s.shadow) {
    shadows.push('0.15em 0.15em 0.25em rgba(0,0,0,0.8)')
  }

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 flex justify-center px-[4%] pointer-events-none ${POSITION_CLASS[s.position]}`}
    >
      {active && (
        <div
          className="text-center max-w-full"
          style={{
            // F-09 和欧混植: 欧文フォントを先頭に置き、英数字だけ差し替える
            fontFamily: fontFamilyToCss(s.fontFamily, s.latinFontEnabled),
            fontSize: `${fontSize}px`,
            fontWeight: s.bold ? 700 : 400,
            fontStyle: s.italic ? 'italic' : 'normal',
            color: s.textColor,
            // 書き出し(ASS)と同じ行送り。背景は行ごとに独立した箱（重なり無し）
            lineHeight: 1.35,
            textShadow: shadows.length > 0 ? shadows.join(', ') : 'none',
          }}
        >
          {lines.map((lineSpans, li) => (
            // whitespace-pre: 改行は自前計算のみ（CSSの再折返しで書き出しとズレるのを防ぐ）
            <div key={li} className="whitespace-pre">
              <span
                style={
                  s.backgroundEnabled
                    ? {
                        backgroundColor: hexToRgba(s.backgroundColor, s.backgroundOpacity),
                        padding: '0.08em 0.25em',
                      }
                    : undefined
                }
              >
                {lineSpans.map((p, i) => {
                  if (!p.run) return <span key={i}>{p.text}</span>
                  const style: React.CSSProperties = {}
                  if (p.run.sizeMultiplier) style.fontSize = `${fontSize * p.run.sizeMultiplier}px`
                  if (p.run.color) style.color = p.run.color
                  if (p.run.bold) style.fontWeight = 800
                  if (p.run.backgroundColor) {
                    // 部分背景（マーカー風ハイライト）。書き出しでは縁取り色による近似になる
                    style.backgroundColor = p.run.backgroundColor
                    style.borderRadius = '0.12em'
                    style.padding = '0.02em 0.08em'
                    style.boxDecorationBreak = 'clone'
                    style.WebkitBoxDecorationBreak = 'clone'
                  }
                  return <span key={i} style={style}>{p.text}</span>
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
