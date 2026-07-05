'use client'
import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { SubtitleOverlay } from '@/components/subtitle/SubtitleOverlay'
import { OutputAspect } from '@/types/subtitle'

// iPhone 16 Pro の画面比（幅/高さ, ポートレート）: 1206 x 2622px
const IPHONE16PRO_RATIO = 1206 / 2622

/** 出力アスペクト比（幅/高さ）。original は動画の実寸から求める */
function outputRatio(aspect: OutputAspect, natW: number, natH: number): number {
  switch (aspect) {
    case '9:16':
      return 9 / 16
    case '1:1':
      return 1
    case '16:9':
      return 16 / 9
    case 'original':
    default:
      return natW > 0 && natH > 0 ? natW / natH : 16 / 9
  }
}

/** 領域(W×H)に収まる、比率 ratio(=幅/高さ) の最大の長方形を返す */
function fitRect(W: number, H: number, ratio: number): { w: number; h: number } {
  if (W <= 0 || H <= 0 || ratio <= 0) return { w: 0, h: 0 }
  if (W / H > ratio) return { w: H * ratio, h: H }
  return { w: W, h: W / ratio }
}

export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const {
    videoUrl,
    outputSettings,
    naturalWidth,
    naturalHeight,
    previewDevice,
    previewOrientation,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setNaturalSize,
    setPreviewDevice,
    setPreviewOrientation,
  } = useEditorStore()
  const [area, setArea] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) return
    video.src = videoUrl
  }, [videoUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTime = () => setCurrentTime(video.currentTime)
    const onMeta = () => {
      setDuration(video.duration)
      setNaturalSize(video.videoWidth, video.videoHeight)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
    }
  }, [setCurrentTime, setDuration, setIsPlaying, setNaturalSize])

  // 表示領域の実寸を測る（端末枠・出力フレームのピクセルサイズ計算用）
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const update = () => setArea({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (!videoUrl) return null

  const isPhone = previewDevice === 'iphone16pro'
  const oRatio = outputRatio(outputSettings.aspect, naturalWidth, naturalHeight)
  const deviceRatio =
    previewOrientation === 'landscape' ? 1 / IPHONE16PRO_RATIO : IPHONE16PRO_RATIO

  // 端末画面 → その中に書き出しと同じ出力フレーム、の順に最大化して収める
  const screen = isPhone ? fitRect(area.w, area.h, deviceRatio) : { w: area.w, h: area.h }
  const stage = fitRect(screen.w, screen.h, oRatio)
  const useCover = outputSettings.aspect !== 'original' && outputSettings.fit === 'crop'

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {/* プレビュー切替 */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border border-gray-800">
          {([
            { key: 'normal', label: '通常' },
            { key: 'iphone16pro', label: '📱 iPhone 16 Pro' },
          ] as const).map((d) => (
            <button
              key={d.key}
              onClick={() => setPreviewDevice(d.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors
                ${previewDevice === d.key ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-gray-200'}`}
            >
              {d.label}
            </button>
          ))}
        </div>
        {isPhone && (
          <div className="flex rounded-lg overflow-hidden border border-gray-800">
            {([
              { key: 'portrait', label: '縦' },
              { key: 'landscape', label: '横' },
            ] as const).map((o) => (
              <button
                key={o.key}
                onClick={() => setPreviewOrientation(o.key)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors
                  ${previewOrientation === o.key ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-gray-200'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 表示領域 */}
      <div ref={areaRef} className="flex-1 min-h-0 flex items-center justify-center">
        {/* 端末画面（枠なし＝画面のみ）。中に「書き出しと同じ出力フレーム」を表示 */}
        <div
          className="relative bg-black overflow-hidden flex items-center justify-center"
          style={{
            width: screen.w || undefined,
            height: screen.h || undefined,
            borderRadius: isPhone ? '2rem' : '0.75rem',
          }}
        >
          <div
            className="relative bg-black overflow-hidden"
            style={{ width: stage.w || undefined, height: stage.h || undefined }}
          >
            <video
              ref={videoRef}
              className={`w-full h-full ${useCover ? 'object-cover' : 'object-contain'}`}
              controls
              playsInline
            />
            <SubtitleOverlay />
          </div>
        </div>
      </div>
    </div>
  )
}
