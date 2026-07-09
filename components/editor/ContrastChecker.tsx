'use client'
import { RefObject, useEffect, useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { mergeStyle } from '@/lib/subtitle-style'
import { contrastRatio, hexToRgbValues, sampleVideoBand } from '@/lib/contrast'
import { TELOP_RULES } from '@/lib/telop-rules'

/**
 * F-03 コントラストチェッカー & 自動可読性補正。
 * 表示中テロップの帯の背景色をサンプリングし、文字色とのWCAGコントラスト比が
 * 4.5:1 未満なら警告チップを表示。ワンタップで縁取り/座布団を追加できる。
 */
export function ContrastChecker({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
  const { segments, currentTime, subtitleStyle, setSubtitleStyle } = useEditorStore()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ratio, setRatio] = useState<number | null>(null)

  const active = segments.find(
    (seg) => currentTime >= seg.startTime && currentTime <= seg.endTime
  )
  const eff = mergeStyle(subtitleStyle, active?.styleOverride)
  // 縁取り or 座布団があれば可読性は確保済みとみなす（F-03の補正優先順位に対応）
  const mitigated = eff.outline || eff.backgroundEnabled

  useEffect(() => {
    if (!active || mitigated) {
      setRatio(null)
      return
    }
    const video = videoRef.current
    if (!video) return
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas')

    const check = () => {
      const bg = sampleVideoBand(video, eff.position, canvasRef.current!)
      if (!bg) return
      setRatio(contrastRatio(bg, hexToRgbValues(eff.textColor)))
    }
    check()
    const timer = setInterval(check, 700)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, mitigated, eff.position, eff.textColor])

  if (!active || mitigated || ratio === null || ratio >= TELOP_RULES.minContrast) return null

  return (
    <div className="flex items-center justify-center gap-2 text-xs bg-amber-950/70 border border-amber-700/60 text-amber-200 rounded-lg px-3 py-1.5">
      <span>
        ⚠ テロップが背景に溶けています（コントラスト {ratio.toFixed(1)}:1 / 推奨 {TELOP_RULES.minContrast}:1）
      </span>
      <button
        onClick={() => setSubtitleStyle({ outline: true, outlineColor: '#000000' })}
        className="px-2 py-0.5 rounded bg-amber-700/60 hover:bg-amber-600/60 text-white flex-shrink-0"
      >
        縁取りを追加
      </button>
      <button
        onClick={() => setSubtitleStyle({ backgroundEnabled: true, backgroundOpacity: 0.55 })}
        className="px-2 py-0.5 rounded bg-amber-700/60 hover:bg-amber-600/60 text-white flex-shrink-0"
      >
        座布団を追加
      </button>
    </div>
  )
}
