'use client'
import { useEditorStore } from '@/store/editorStore'
import { useTranscribe } from '@/hooks/useTranscribe'
import { useExport } from '@/hooks/useExport'

export function Toolbar() {
  const { filename, segments, isTranscribing, isExporting, sessionId } = useEditorStore()
  const { transcribe } = useTranscribe()
  const { exportVideo } = useExport()

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
