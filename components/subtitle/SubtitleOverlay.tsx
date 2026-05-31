'use client'
import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { SubtitleSegment } from '@/types/subtitle'
import { fontFamilyToCss, hexToRgba, wrapText } from '@/lib/subtitle-style'

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
  const [boxHeight, setBoxHeight] = useState(0)

  // 動画ボックスの高さを測ってフォントサイズを%換算（出力との見た目を揃えるため）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setBoxHeight(el.clientHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const active = findActiveSegment(segments, currentTime)
  const s = subtitleStyle
  const fontSize = (boxHeight * s.fontSizePercent) / 100

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
          {wrapText(active.text, s.maxCharsPerLine)}
        </span>
      )}
    </div>
  )
}
