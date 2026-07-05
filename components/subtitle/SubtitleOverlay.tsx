'use client'
import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { SubtitleSegment } from '@/types/subtitle'
import { fontFamilyToCss, hexToRgba } from '@/lib/subtitle-style'
import { parseRichText, wrapSpans, splitSpansByLine } from '@/lib/rich-text'
import { RichText } from './RichText'

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

export function SubtitleOverlay() {
  const { segments, currentTime, subtitleStyle } = useEditorStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

  // フレームの実寸を測ってフォントサイズ・改行位置を出力と揃える
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setBox({ width: el.clientWidth, height: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const active = findActiveSegment(segments, currentTime)
  // 個別デザインがあれば全体設定に上書きマージ
  const s = { ...subtitleStyle, ...active?.styleOverride }
  const fontSize = (box.height * s.fontSizePercent) / 100

  // 書き出し(ASS)と同じ式で1行の文字数を計算し、同じ位置で改行する
  const marginLR = box.width * 0.04
  const usableWidth = box.width - marginLR * 2
  const autoMaxChars = fontSize > 0 ? Math.max(1, Math.floor(usableWidth / fontSize)) : 0
  const effectiveMaxChars =
    s.maxCharsPerLine > 0 && autoMaxChars > 0
      ? Math.min(s.maxCharsPerLine, autoMaxChars)
      : autoMaxChars

  // 書き出しと同じく行ごとに分割して描画（背景ボックスも行単位で独立させる）
  const lines = active
    ? splitSpansByLine(wrapSpans(parseRichText(active.text), effectiveMaxChars))
    : []

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
            fontFamily: fontFamilyToCss(s.fontFamily),
            fontSize: `${fontSize}px`,
            fontWeight: s.bold ? 700 : 400,
            fontStyle: s.italic ? 'italic' : 'normal',
            color: s.textColor,
            // 書き出し(ASS)と同じ行送り。背景は行ごとに独立した箱（重なり無し）
            lineHeight: 1.35,
            textShadow: shadows.length > 0 ? shadows.join(', ') : 'none',
          }}
        >
          {lines.map((lineSpans, i) => (
            // whitespace-pre: 改行は自前計算のみ（CSSの再折返しで書き出しとズレるのを防ぐ）
            <div key={i} className="whitespace-pre">
              <span
                style={
                  s.backgroundEnabled
                    ? {
                        backgroundColor: hexToRgba(s.backgroundColor, s.backgroundOpacity),
                        padding: '0.08em 0.25em',
                        boxDecorationBreak: 'clone',
                        WebkitBoxDecorationBreak: 'clone',
                      }
                    : undefined
                }
              >
                <RichText spans={lineSpans} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
