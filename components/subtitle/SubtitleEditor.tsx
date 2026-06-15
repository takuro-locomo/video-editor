'use client'
import { useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { SubtitleFontFamily, SubtitleSegment, StyleRun } from '@/types/subtitle'
import { formatTime } from '@/lib/time-utils'

const FONT_OPTIONS: { value: SubtitleFontFamily; label: string }[] = [
  { value: 'gothic', label: 'ゴシック' },
  { value: 'mincho', label: '明朝' },
  { value: 'notosans', label: 'Noto' },
]

function SubtitleItem({
  segment,
  isActive,
  isLast,
  currentTime,
  onClick,
}: {
  segment: SubtitleSegment
  isActive: boolean
  isLast: boolean
  currentTime: number
  onClick: () => void
}) {
  const {
    subtitleStyle,
    updateSegment,
    updateSegmentStyle,
    updateSegmentRuns,
    deleteSegment,
    setCurrentTime,
    splitSegment,
    mergeWithNext,
  } = useEditorStore()

  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(segment.text)
  const [isStyleOpen, setIsStyleOpen] = useState(false)
  const [selection, setSelection] = useState<{ from: number; to: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSplit = currentTime > segment.startTime && currentTime < segment.endTime
  const hasOverride = !!segment.styleOverride && Object.keys(segment.styleOverride).length > 0

  // テキスト変更時はインライン装飾をリセット
  const save = () => {
    const textChanged = editText !== segment.text
    updateSegment(segment.id, {
      text: editText,
      styleRuns: textChanged ? undefined : segment.styleRuns,
    })
    setIsEditing(false)
    setSelection(null)
  }

  const captureSelection = () => {
    const ta = textareaRef.current
    if (!ta || ta.selectionStart === ta.selectionEnd) { setSelection(null); return }
    setSelection({ from: ta.selectionStart, to: ta.selectionEnd })
  }

  const applyBig = () => {
    if (!selection) return
    const run: StyleRun = { from: selection.from, to: selection.to, sizeMultiplier: 1.5 }
    const existing = (segment.styleRuns ?? []).filter(
      (r) => r.to <= selection.from || r.from >= selection.to
    )
    updateSegmentRuns(segment.id, [...existing, run])
    setSelection(null)
  }

  const applyRunColor = (color: string) => {
    if (!selection) return
    const run: StyleRun = { from: selection.from, to: selection.to, color }
    const existing = (segment.styleRuns ?? []).filter(
      (r) => r.to <= selection.from || r.from >= selection.to
    )
    updateSegmentRuns(segment.id, [...existing, run])
    setSelection(null)
  }

  // グローバルとマージした有効値（個別パネルの表示用）
  const eff = { ...subtitleStyle, ...segment.styleOverride }

  return (
    <div
      className={`rounded-xl p-3 border transition-colors cursor-pointer
        ${isActive ? 'border-blue-500 bg-blue-950/40' : 'border-gray-800 bg-gray-900 hover:border-gray-700'}`}
      onClick={onClick}
    >
      {/* ヘッダー行 */}
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
        <div className="flex gap-1">
          <button
            className="text-xs text-gray-500 hover:text-white px-2 py-0.5 rounded disabled:opacity-30"
            onClick={(e) => { e.stopPropagation(); splitSegment(segment.id, currentTime) }}
            disabled={!canSplit}
            title="再生位置で分割"
          >分割</button>
          <button
            className="text-xs text-gray-500 hover:text-white px-2 py-0.5 rounded disabled:opacity-30"
            onClick={(e) => { e.stopPropagation(); mergeWithNext(segment.id) }}
            disabled={isLast}
            title="次の字幕と結合"
          >結合</button>
          <button
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              isStyleOpen
                ? 'bg-purple-700 text-white'
                : hasOverride
                ? 'text-purple-400 hover:text-purple-300'
                : 'text-gray-500 hover:text-white'
            }`}
            onClick={(e) => { e.stopPropagation(); setIsStyleOpen((v) => !v) }}
            title="このテロップだけスタイルを変える"
          >🎨{hasOverride ? '●' : ''}</button>
          <button
            className="text-xs text-gray-500 hover:text-white px-2 py-0.5 rounded"
            onClick={(e) => {
              e.stopPropagation()
              setIsEditing(!isEditing)
              setEditText(segment.text)
              setSelection(null)
            }}
          >{isEditing ? 'キャンセル' : '編集'}</button>
          <button
            className="text-xs text-red-500 hover:text-red-400 px-2 py-0.5 rounded"
            onClick={(e) => { e.stopPropagation(); deleteSegment(segment.id) }}
          >削除</button>
        </div>
      </div>

      {/* 個別スタイルパネル */}
      {isStyleOpen && (
        <div
          className="mt-2 p-3 rounded-lg bg-gray-800 border border-gray-700 space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs text-purple-300 font-medium">このテロップだけのスタイル</p>

          <div className="space-y-1">
            <label className="text-xs text-gray-400">フォント</label>
            <div className="grid grid-cols-3 gap-1">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => updateSegmentStyle(segment.id, { fontFamily: f.value })}
                  className={`text-xs py-1.5 rounded border transition-colors ${
                    eff.fontFamily === f.value
                      ? 'border-purple-500 bg-purple-950 text-white'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >{f.label}</button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-400">文字色</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={eff.textColor}
                onChange={(e) => updateSegmentStyle(segment.id, { textColor: e.target.value })}
                className="w-10 h-8 rounded cursor-pointer bg-transparent border border-gray-700 p-0.5"
              />
              <span className="text-xs text-gray-400 font-mono">{eff.textColor}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-400">文字サイズ（{eff.fontSizePercent}%）</label>
            <input
              type="range" min={3} max={12} step={0.5}
              value={eff.fontSizePercent}
              onChange={(e) => updateSegmentStyle(segment.id, { fontSizePercent: Number(e.target.value) })}
              className="w-full accent-purple-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => updateSegmentStyle(segment.id, { bold: !eff.bold })}
              className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                eff.bold ? 'border-purple-500 bg-purple-950 text-white' : 'border-gray-700 text-gray-400'
              }`}
            >太字 {eff.bold ? 'ON' : 'OFF'}</button>
            <button
              onClick={() => updateSegmentStyle(segment.id, null)}
              className="flex-1 text-xs py-1.5 rounded border border-gray-700 text-red-400 hover:text-red-300"
            >全体設定に戻す</button>
          </div>

          {/* インラインランの一覧 */}
          {(segment.styleRuns?.length ?? 0) > 0 && (
            <div className="space-y-1">
              <label className="text-xs text-gray-400">文字装飾</label>
              {segment.styleRuns!.map((run, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-900 rounded px-2 py-1">
                  <span className="text-xs text-gray-300 flex-1 truncate">
                    「{segment.text.slice(run.from, run.to)}」
                  </span>
                  {run.sizeMultiplier && (
                    <span className="text-xs text-blue-400">×{run.sizeMultiplier}</span>
                  )}
                  {run.color && (
                    <span
                      className="w-4 h-4 rounded-full inline-block border border-gray-600 flex-shrink-0"
                      style={{ backgroundColor: run.color }}
                    />
                  )}
                  <button
                    onClick={() =>
                      updateSegmentRuns(
                        segment.id,
                        segment.styleRuns!.filter((_, j) => j !== i)
                      )
                    }
                    className="text-red-500 hover:text-red-400 text-xs"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* テキスト（編集モード） */}
      {isEditing ? (
        <div className="space-y-2 mt-1" onClick={(e) => e.stopPropagation()}>
          <textarea
            ref={textareaRef}
            className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm resize-none border border-gray-700 focus:border-blue-500 outline-none"
            rows={2}
            value={editText}
            onChange={(e) => { setEditText(e.target.value); setSelection(null) }}
            onSelect={captureSelection}
            onKeyUp={captureSelection}
            onMouseUp={captureSelection}
            autoFocus
          />

          {/* 選択時のインライン装飾バー */}
          {selection && (
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5">
              <span className="text-xs text-gray-400 flex-1 truncate min-w-0">
                「{editText.slice(selection.from, selection.to)}」を装飾
              </span>
              <button
                onMouseDown={(e) => { e.preventDefault(); applyBig() }}
                className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-0.5 rounded flex-shrink-0"
              >A+ 大きく</button>
              <label className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-0.5 rounded cursor-pointer flex-shrink-0 relative">
                色を変える
                <input
                  type="color"
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  defaultValue="#FFD700"
                  onInput={(e) => applyRunColor((e.target as HTMLInputElement).value)}
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-400">
              開始: {formatTime(segment.startTime)}
              <input
                type="range" min={0} max={segment.endTime - 0.1} step={0.1}
                value={segment.startTime}
                onChange={(e) => updateSegment(segment.id, { startTime: Number(e.target.value) })}
                className="w-full mt-1 accent-blue-500"
              />
            </label>
            <label className="text-xs text-gray-400">
              終了: {formatTime(segment.endTime)}
              <input
                type="range" min={segment.startTime + 0.1} max={segment.startTime + 30} step={0.1}
                value={segment.endTime}
                onChange={(e) => updateSegment(segment.id, { endTime: Number(e.target.value) })}
                className="w-full mt-1 accent-blue-500"
              />
            </label>
          </div>
          <button
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm py-1.5 rounded-lg"
            onClick={save}
          >保存</button>
        </div>
      ) : (
        <p className="text-white text-sm leading-relaxed">{segment.text}</p>
      )}
    </div>
  )
}

export function SubtitleEditor() {
  const { segments, currentTime, isTranscribing, transcribeProgress, addSegmentAt } =
    useEditorStore()

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
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <div className="text-4xl">📝</div>
        <p className="text-gray-400 text-sm">「AI字幕生成」ボタンを押して<br />音声を文字起こしします</p>
        <button
          onClick={() => addSegmentAt(currentTime)}
          className="mt-1 text-sm text-blue-400 hover:text-blue-300 border border-gray-700 rounded-lg px-3 py-1.5"
        >
          ＋ 手動で字幕を追加
        </button>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full p-3 space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-gray-500 text-xs">{segments.length}件の字幕</p>
        <button
          onClick={() => addSegmentAt(currentTime)}
          className="text-xs text-blue-400 hover:text-blue-300"
          title="再生位置に空の字幕を追加"
        >
          ＋ 現在位置に追加
        </button>
      </div>
      {segments.map((seg, i) => (
        <SubtitleItem
          key={seg.id}
          segment={seg}
          isActive={currentTime >= seg.startTime && currentTime <= seg.endTime}
          isLast={i === segments.length - 1}
          currentTime={currentTime}
          onClick={() => useEditorStore.getState().setCurrentTime(seg.startTime)}
        />
      ))}
    </div>
  )
}
