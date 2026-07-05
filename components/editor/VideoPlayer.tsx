'use client'
import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { SubtitleOverlay } from '@/components/subtitle/SubtitleOverlay'

const ASPECT_RATIOS: Record<string, number> = {
  '9:16': 9 / 16,
  '1:1': 1,
  '16:9': 16 / 9,
}

export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const { videoUrl, outputSettings, setCurrentTime, setDuration, setIsPlaying } =
    useEditorStore()
  const [videoRatio, setVideoRatio] = useState(16 / 9) // 元動画の縦横比
  const [areaSize, setAreaSize] = useState({ width: 0, height: 0 })
  const [previewOutput, setPreviewOutput] = useState(true) // 書き出しプレビューON/OFF

  // 表示エリアの実寸を測り、フレームがはみ出さない最大サイズを計算する
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const update = () => setAreaSize({ width: el.clientWidth, height: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (!videoUrl) return null

  const isFormatted = previewOutput && outputSettings.aspect !== 'original'
  const frameRatio = isFormatted ? ASPECT_RATIOS[outputSettings.aspect] : videoRatio

  // エリア内に収まるフレーム寸法（縦横比維持）
  let frameW = areaSize.width
  let frameH = frameW / frameRatio
  if (frameH > areaSize.height) {
    frameH = areaSize.height
    frameW = frameH * frameRatio
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* プレビュー切替（出力アスペクト比が指定されている時のみ） */}
      {outputSettings.aspect !== 'original' && (
        <div className="flex items-center justify-center gap-1.5 pb-2">
          <button
            onClick={() => setPreviewOutput(true)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors
              ${previewOutput
                ? 'border-blue-500 bg-blue-950/40 text-white'
                : 'border-gray-800 bg-gray-900 text-gray-500 hover:text-gray-300'}`}
          >
            📱 書き出しプレビュー（{outputSettings.aspect}）
          </button>
          <button
            onClick={() => setPreviewOutput(false)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors
              ${!previewOutput
                ? 'border-blue-500 bg-blue-950/40 text-white'
                : 'border-gray-800 bg-gray-900 text-gray-500 hover:text-gray-300'}`}
          >
            元動画
          </button>
        </div>
      )}

      <div ref={areaRef} className="flex-1 min-h-0 flex items-center justify-center">
        <div
          className="relative bg-black rounded-xl overflow-hidden"
          style={{ width: Math.max(frameW, 1), height: Math.max(frameH, 1) }}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            className={`w-full h-full ${
              isFormatted && outputSettings.fit === 'crop'
                ? 'object-cover'
                : 'object-contain'
            }`}
            controls
            playsInline
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget
              setDuration(v.duration)
              if (v.videoWidth && v.videoHeight) {
                setVideoRatio(v.videoWidth / v.videoHeight)
              }
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          <SubtitleOverlay />
        </div>
      </div>
    </div>
  )
}
