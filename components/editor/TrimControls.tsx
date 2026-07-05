'use client'
import { useEditorStore } from '@/store/editorStore'
import { formatTime } from '@/lib/time-utils'

export function TrimControls() {
  const {
    duration,
    currentTime,
    trimRanges,
    addTrimRange,
    updateTrimRange,
    deleteTrimRange,
    clearTrimRanges,
  } = useEditorStore()

  const handleAdd = () => {
    const end = Math.min(currentTime + 10, duration || currentTime + 10)
    const start = Math.max(0, Math.min(currentTime, end - 0.1))
    addTrimRange(start, end)
  }

  const setStart = (i: number) => {
    const r = trimRanges[i]
    updateTrimRange(i, { start: Math.max(0, Math.min(currentTime, r.end - 0.1)) })
  }

  const setEnd = (i: number) => {
    const r = trimRanges[i]
    updateTrimRange(i, { end: Math.min(duration || currentTime, Math.max(currentTime, r.start + 0.1)) })
  }

  return (
    <div className="mt-3 p-3 rounded-lg bg-gray-900 border border-gray-800 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300">✂️ トリミング区間</span>
        {trimRanges.length > 0 && (
          <button
            onClick={clearTrimRanges}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            全解除
          </button>
        )}
      </div>

      {trimRanges.length === 0 && (
        <p className="text-[11px] text-gray-600">
          区間を追加すると、その区間だけが書き出されます。複数追加して結合することもできます。
        </p>
      )}

      {trimRanges.map((range, i) => (
        <div key={i} className="bg-gray-800/60 rounded-lg p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 font-mono">
              区間 {i + 1}：{formatTime(range.start)} → {formatTime(range.end)}
              <span className="text-gray-600 ml-1">（{formatTime(range.end - range.start)}）</span>
            </span>
            <button
              onClick={() => deleteTrimRange(i)}
              className="text-[11px] text-red-500 hover:text-red-400 transition-colors"
            >
              削除
            </button>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setStart(i)}
              className="flex-1 text-xs py-1 rounded border border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600 transition-colors"
            >
              開始をここに
            </button>
            <button
              onClick={() => setEnd(i)}
              className="flex-1 text-xs py-1 rounded border border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600 transition-colors"
            >
              終了をここに
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={handleAdd}
        className="w-full text-xs py-1.5 rounded-md border border-dashed border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
      >
        ＋ 現在位置から区間を追加
      </button>
    </div>
  )
}
