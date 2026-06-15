'use client'
import { useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { useTranscribe } from '@/hooks/useTranscribe'
import { useExport } from '@/hooks/useExport'

export function Toolbar() {
  const { filename, segments, isTranscribing, isExporting, sessionId, setVideoUrl } =
    useEditorStore()
  const { transcribe } = useTranscribe()
  const { exportVideo } = useExport()

  const [isAppending, setIsAppending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAppendFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !sessionId) return
    e.target.value = ''

    setIsAppending(true)
    try {
      const form = new FormData()
      form.append('sessionId', sessionId)
      form.append('video', file)

      const res = await fetch('/api/append', { method: 'POST', body: form })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
        alert(`動画追加に失敗しました: ${error}`)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setVideoUrl(url)
    } catch (err) {
      alert(`動画追加エラー: ${err}`)
    } finally {
      setIsAppending(false)
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
      <div className="flex items-center gap-3">
        <span className="text-white font-semibold text-sm truncate max-w-48">{filename}</span>
        {segments.length > 0 && (
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
            字幕 {segments.length}件
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* 動画追加 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleAppendFile}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!sessionId || isAppending || isTranscribing || isExporting}
          className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-3 py-2 rounded-lg transition-colors"
          title="末尾に別の動画を追加して結合"
        >
          {isAppending ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              結合中...
            </>
          ) : '＋ 動画を追加'}
        </button>

        <button
          onClick={transcribe}
          disabled={!sessionId || isTranscribing || isExporting}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          {isTranscribing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              解析中...
            </>
          ) : '🤖 AI字幕生成'}
        </button>

        <button
          onClick={exportVideo}
          disabled={segments.length === 0 || isExporting || isTranscribing}
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          {isExporting ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              書き出し中...
            </>
          ) : '⬇️ MP4書き出し'}
        </button>
      </div>
    </div>
  )
}
