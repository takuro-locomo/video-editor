'use client'
import { useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { useTranscribe } from '@/hooks/useTranscribe'
import { useExport } from '@/hooks/useExport'

export function Toolbar() {
  const { filename, segments, isTranscribing, isExporting, sessionId, replaceVideo } =
    useEditorStore()
  const { transcribe } = useTranscribe()
  const { exportVideo } = useExport()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isAppending, setIsAppending] = useState(false)

  const appendVideos = async (list: FileList) => {
    if (!sessionId) return
    const files = Array.from(list).filter((f) => f.type.startsWith('video/'))
    if (files.length === 0) return
    // クラウド未ダウンロード等で読み取れないファイルを事前に検出
    const { checkFileReadable } = await import('@/lib/file-utils')
    for (const f of files) {
      const problem = await checkFileReadable(f)
      if (problem) {
        alert(problem)
        return
      }
    }
    setIsAppending(true)

    try {
      const fd = new FormData()
      fd.append('sessionId', sessionId)
      files.forEach((f) => fd.append('videos', f))
      const res = await fetch('/api/append', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Append failed')
      }
      // 末尾への追加なので既存の字幕タイミングはそのまま有効
      // （URLにv=を付けて動画プレーヤーに再読み込みさせる）
      replaceVideo(`/api/video/${sessionId}?v=${Date.now()}`, '結合動画.mp4')
    } catch (err) {
      console.error(err)
      alert(`動画の追加に失敗しました\n${err instanceof Error ? err.message : ''}`)
    } finally {
      setIsAppending(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const busy = isTranscribing || isExporting || isAppending

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
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && appendVideos(e.target.files)}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!sessionId || busy}
          className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors"
          title="選択した動画を現在の動画の末尾に結合します"
        >
          {isAppending ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              結合中...
            </>
          ) : '➕ 動画を追加'}
        </button>

        <button
          onClick={transcribe}
          disabled={!sessionId || busy}
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
          disabled={segments.length === 0 || busy}
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
