'use client'
import { useEditorStore } from '@/store/editorStore'

export function useTranscribe() {
  const {
    sessionId,
    setSegments,
    setIsTranscribing,
    setTranscribeProgress,
    setActiveTab,
  } = useEditorStore()

  const transcribe = async () => {
    if (!sessionId) return
    setIsTranscribing(true)
    setTranscribeProgress('音声を解析中...')

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `文字起こしに失敗しました (HTTP ${res.status})`)
      }

      const data = await res.json()
      setSegments(data.segments)
      setActiveTab('subtitles')
      setTranscribeProgress('完了')
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'エラーが発生しました'
      setTranscribeProgress(message)
      alert(message)
    } finally {
      setIsTranscribing(false)
    }
  }

  return { transcribe }
}
