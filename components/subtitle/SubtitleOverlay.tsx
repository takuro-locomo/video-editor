'use client'
import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { SubtitleSegment } from '@/types/subtitle'
import { fontFamilyToCss, hexToRgba, wrapText, computeEffectiveMaxChars } from '@/lib/subtitle-style'

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

export function SubtitleOverlay() {
  const { segments, currentTime, subtitleStyle } = useEditorStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  // 出力フレームの実寸を測り、フォントサイズ(%)と折り返し文字数を書き出しと揃える
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
  const s = subtitleStyle
  const fontSize = (box.h * s.fontSizePercent) / 100
  // 書き出し(segmentsToAss)と同じ実効最大文字数で折り返す
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
          {wrapText(active.text, effectiveMaxChars)}
        </span>
      )}
    </div>
  )
}
