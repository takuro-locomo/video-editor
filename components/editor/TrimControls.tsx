'use client'
import { useEditorStore } from '@/store/editorStore'
import { formatTime } from '@/lib/time-utils'

export function TrimControls() {
  const {
    duration,
    currentTime,
    trimStart,
    trimEnd,
    setTrimStart,
    setTrimEnd,
    resetTrim,
  } = useEditorStore()

  const start = trimStart ?? 0
  const end = trimEnd ?? duration
  const trimmed = trimStart !== null || trimEnd !== null
  const clipLength = Math.max(0, end - start)

  const setStartHere = () => {
    // 終了より後ろは不可
    const t = trimEnd !== null ? Math.min(currentTime, trimEnd - 0.1) : currentTime
    setTrimStart(Math.max(0, t))
  }
  const setEndHere = () => {
    // 開始より前は不可
    const t = trimStart !== null ? Math.max(currentTime, trimStart + 0.1) : currentTime
    setTrimEnd(Math.min(duration || currentTime, t))
  }

  return (
    <div className="mt-3 p-3 rounded-lg bg-gray-900 border border-gray-800 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300">✂️ トリミング</span>
        {trimmed && (
          <button
            onClick={resetTrim}
            className="text-[11px] text-gray-500 hover:text-gray-300"
          >
            解除
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={setStartHere}
          className="flex-1 text-xs py-1.5 rounded-md border border-gray-700 bg-gray-800 text-gray-200 hover:border-gray-600"
        >
          開始を現在位置に
        </button>
        <button
          onClick={setEndHere}
          className="flex-1 text-xs py-1.5 rounded-md border border-gray-700 bg-gray-800 text-gray-200 hover:border-gray-600"
        >
          終了を現在位置に
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
        <span>開始 {formatTime(start)}</span>
        <span>長さ {formatTime(clipLength)}</span>
        <span>終了 {formatTime(end)}</span>
      </div>
      <p className="text-[11px] text-gray-600">
        動画を再生バーで目的の位置に合わせ、ボタンで開始/終了を指定します。書き出し時にこの区間だけが出力されます。
      </p>
    </div>
  )
}
