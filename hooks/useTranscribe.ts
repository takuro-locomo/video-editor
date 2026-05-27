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

      if (!res.ok) throw new Error(await res.text())

      const data = await res.json()
      setSegments(data.segments)
      setActiveTab('subtitles')
      setTranscribeProgress('完了')
    } catch (err) {
      console.error(err)
      setTranscribeProgress('エラーが発生しました')
    } finally {
      setIsTranscribing(false)
    }
  }

  return { transcribe }
}
