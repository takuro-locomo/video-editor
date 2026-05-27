'use client'
import { useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { SubtitleSegment } from '@/types/subtitle'
import { formatTime } from '@/lib/time-utils'

function SubtitleItem({
  segment,
  isActive,
  onClick,
}: {
  segment: SubtitleSegment
  isActive: boolean
  onClick: () => void
}) {
  const { updateSegment, deleteSegment, setCurrentTime } = useEditorStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(segment.text)

  const save = () => {
    updateSegment(segment.id, { text: editText })
    setIsEditing(false)
  }

  return (
    <div
      className={`rounded-xl p-3 border transition-colors cursor-pointer
        ${isActive ? 'border-blue-500 bg-blue-950/40' : 'border-gray-800 bg-gray-900 hover:border-gray-700'}`}
      onClick={onClick}
    >
      {/* タイムスタンプ */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <button
            className="text-xs text-blue-400 hover:text-blue-300 font-mono"
            onClick={(e) => { e.stopPropagation(); setCurrentTime(segment.startTime) }}
          >
            {formatTime(segment.startTime)}
          </button>
          <span className="text-gray-600 text-xs">→</span>
          <span className="text-xs text-gray-500 font-mono">{formatTime(segment.endTime)}</span>
        </div>
        <div className="flex gap-2">
          <button
            className="text-xs text-gray-500 hover:text-white px-2 py-0.5 rounded"
            onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); setEditText(segment.text) }}
          >
            {isEditing ? 'キャンセル' : '編集'}
          </button>
          <button
            className="text-xs text-red-500 hover:text-red-400 px-2 py-0.5 rounded"
            onClick={(e) => { e.stopPropagation(); deleteSegment(segment.id) }}
          >
            削除
          </button>
        </div>
      </div>

      {/* テキスト */}
      {isEditing ? (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <textarea
            className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm resize-none border border-gray-700 focus:border-blue-500 outline-none"
            rows={2}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            autoFocus
          />
          {/* タイミング調整 */}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-400">
              開始: {formatTime(segment.startTime)}
              <input
                type="range"
                min={0}
                max={segment.endTime - 0.1}
                step={0.1}
                value={segment.startTime}
                onChange={(e) => updateSegment(segment.id, { startTime: Number(e.target.value) })}
                className="w-full mt-1 accent-blue-500"
              />
            </label>
            <label className="text-xs text-gray-400">
              終了: {formatTime(segment.endTime)}
              <input
                type="range"
                min={segment.startTime + 0.1}
                max={segment.startTime + 30}
                step={0.1}
                value={segment.endTime}
                onChange={(e) => updateSegment(segment.id, { endTime: Number(e.target.value) })}
                className="w-full mt-1 accent-blue-500"
              />
            </label>
          </div>
          <button
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm py-1.5 rounded-lg"
            onClick={save}
          >
            保存
          </button>
        </div>
      ) : (
        <p className="text-white text-sm leading-relaxed">{segment.text}</p>
      )}
    </div>
  )
}

export function SubtitleEditor() {
  const { segments, currentTime, isTranscribing, transcribeProgress } = useEditorStore()

  if (isTranscribing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">{transcribeProgress}</p>
      </div>
    )
  }

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
        <div className="text-4xl">📝</div>
        <p className="text-gray-400 text-sm">「AI字幕生成」ボタンを押して<br />音声を文字起こしします</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full p-3 space-y-2">
      <p className="text-gray-500 text-xs px-1">{segments.length}件の字幕</p>
      {segments.map((seg) => (
        <SubtitleItem
          key={seg.id}
          segment={seg}
          isActive={currentTime >= seg.startTime && currentTime <= seg.endTime}
          onClick={() => useEditorStore.getState().setCurrentTime(seg.startTime)}
        />
      ))}
    </div>
  )
}
