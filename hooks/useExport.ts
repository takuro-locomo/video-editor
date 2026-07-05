'use client'
import { useEditorStore } from '@/store/editorStore'

export function useExport() {
  const {
    sessionId,
    segments,
    subtitleStyle,
    outputSettings,
    trimStart,
    trimEnd,
    duration,
    setIsExporting,
  } = useEditorStore()

  const exportVideo = async () => {
    if (!sessionId) return
    setIsExporting(true)

    // 開始のみ・終了のみの指定でも有効にする（未指定側は 0 / 動画末尾で補完）
    const start = trimStart ?? 0
    const end = trimEnd ?? duration
    const useTrim = (trimStart !== null || trimEnd !== null) && end > start

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          segments,
          style: subtitleStyle,
          output: outputSettings,
          trim: useTrim ? { start, end } : undefined,
        }),
      })

      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'output.mp4'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('書き出しに失敗しました')
    } finally {
      setIsExporting(false)
    }
  }

  return { exportVideo }
}
