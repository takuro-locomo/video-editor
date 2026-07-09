'use client'
import { useEditorStore } from '@/store/editorStore'
import { SAFE_ZONE_PRESETS } from '@/lib/telop-rules'

/**
 * F-04 セーフゾーンガイド。
 * プレビュー（出力フレーム）の上に、媒体別のNGゾーン or 同心ガイドを半透明で重ねる。
 */
export function SafeZoneOverlay() {
  const safeZonePreset = useEditorStore((s) => s.safeZonePreset)
  if (safeZonePreset === 'off') return null
  const preset = SAFE_ZONE_PRESETS[safeZonePreset]
  if (!preset) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* 横型汎用: 90/93/95% の同心ガイド（R-15） */}
      {preset.guides?.map((pct) => {
        const inset = (100 - pct) / 2
        return (
          <div
            key={pct}
            className="absolute border border-dashed border-cyan-400/60"
            style={{ inset: `${inset}%` }}
          >
            <span className="absolute -top-0.5 left-1 text-[9px] text-cyan-300/90 leading-none">
              {pct}%
            </span>
          </div>
        )
      })}

      {/* 媒体別NGゾーン（R-16/R-17） */}
      {preset.ngZones.map((z, i) => (
        <div
          key={i}
          className="absolute bg-red-500/25 border border-red-400/50 flex items-center justify-center overflow-hidden"
          style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%` }}
        >
          {z.label && (
            <span className="text-[9px] text-red-200/90 leading-none px-1 text-center">
              {z.label}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
