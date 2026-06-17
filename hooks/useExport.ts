'use client'
import { useEditorStore } from '@/store/editorStore'

export function useExport() {
  const { sessionId, segments, subtitleStyle, outputSettings, trimRanges, setIsExporting } =
    useEditorStore()

  const exportVideo = async () => {
    if (!sessionId) return
    setIsExporting(true)

    try {
      const activeRanges = trimRanges.filter((r) => r.end > r.start)
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          segments,
          style: subtitleStyle,
          output: outputSettings,
          trimRanges: activeRanges.length > 0 ? activeRanges : undefined,
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
