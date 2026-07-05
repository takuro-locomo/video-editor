'use client'
import { useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { SubtitleSegment, SubtitleStyle, SubtitleFontFamily } from '@/types/subtitle'
import { formatTime } from '@/lib/time-utils'
import { parseRichText, stripRichTags } from '@/lib/rich-text'
import { RichText } from './RichText'

const PART_COLORS = ['#FF3B30', '#FFE600', '#34C759', '#4FC3F7', '#FF6FA5']
const PART_SIZES: { label: string; value: number }[] = [
  { label: '小', value: 75 },
  { label: '大', value: 130 },
  { label: '特大', value: 170 },
]
const FONT_OPTIONS: { value: SubtitleFontFamily; label: string }[] = [
  { value: 'gothic', label: 'ゴシック' },
  { value: 'maru', label: '丸ゴ' },
  { value: 'mincho', label: '明朝' },
  { value: 'notosans', label: 'Noto' },
]

/** 選択中の字幕1件だけのデザイン設定パネル */
function SegmentStylePanel({ segment }: { segment: SubtitleSegment }) {
  const { subtitleStyle, updateSegment } = useEditorStore()
  const ov = segment.styleOverride ?? {}
  const merged: SubtitleStyle = { ...subtitleStyle, ...ov }

  const patch = (p: Partial<SubtitleStyle>) =>
    updateSegment(segment.id, { styleOverride: { ...ov, ...p } })

  const hasOverride = Object.keys(ov).length > 0

  return (
    <div className="mt-2 p-2.5 rounded-lg bg-gray-800/70 border border-gray-700 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-300">
          この字幕だけのデザイン
        </span>
        {hasOverride && (
          <button
            className="text-[11px] text-gray-500 hover:text-gray-300"
            onClick={() => updateSegment(segment.id, { styleOverride: undefined })}
          >
            全体設定に戻す
          </button>
        )}
      </div>

      {/* フォント */}
      <div className="grid grid-cols-4 gap-1">
        {FONT_OPTIONS.map((f) => (
          <button
            key={f.value}
            onClick={() => patch({ fontFamily: f.value })}
            className={`text-[11px] py-1 rounded border transition-colors
              ${merged.fontFamily === f.value
                ? 'border-blue-500 bg-blue-950/40 text-white'
                : 'border-gray-700 bg-gray-800 text-gray-400'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* サイズ */}
      <label className="block text-[11px] text-gray-400">
        文字サイズ（{merged.fontSizePercent}）
        <input
          type="range"
          min={3}
          max={14}
          step={0.5}
          value={merged.fontSizePercent}
          onChange={(e) => patch({ fontSizePercent: Number(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </label>

      {/* 色・縁取り色 */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
          文字色
          <input
            type="color"
            value={merged.textColor}
            onChange={(e) => patch({ textColor: e.target.value })}
            className="w-8 h-7 rounded bg-gray-800 border border-gray-700 cursor-pointer"
          />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
          縁取り色
          <input
            type="color"
            value={merged.outlineColor}
            onChange={(e) => patch({ outlineColor: e.target.value, outline: true })}
            className="w-8 h-7 rounded bg-gray-800 border border-gray-700 cursor-pointer"
          />
        </label>
      </div>

      {/* トグル各種 */}
      <div className="grid grid-cols-4 gap-1">
        {(
          [
            ['太字', 'bold'],
            ['斜体', 'italic'],
            ['縁取り', 'outline'],
            ['影', 'shadow'],
          ] as const
        ).map(([label, key]) => (
          <button
            key={key}
            onClick={() => patch({ [key]: !merged[key] } as Partial<SubtitleStyle>)}
            className={`text-[11px] py-1 rounded border transition-colors
              ${merged[key]
                ? 'border-blue-500 bg-blue-950/40 text-white'
                : 'border-gray-700 bg-gray-800 text-gray-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 位置 */}
      <div className="grid grid-cols-3 gap-1">
        {(
          [
            ['上', 'top'],
            ['中央', 'middle'],
            ['下', 'bottom'],
          ] as const
        ).map(([label, pos]) => (
          <button
            key={pos}
            onClick={() => patch({ position: pos })}
            className={`text-[11px] py-1 rounded border transition-colors
              ${merged.position === pos
                ? 'border-blue-500 bg-blue-950/40 text-white'
                : 'border-gray-700 bg-gray-800 text-gray-400'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

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
  const { updateSegment, deleteSegment, setCurrentTime, splitSegment, mergeWithNext } =
    useEditorStore()
  const [isEditing, setIsEditing] = useState(false)
  const [showDesign, setShowDesign] = useState(false)
  const [editText, setEditText] = useState(segment.text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSplit = currentTime > segment.startTime && currentTime < segment.endTime
  const hasOverride = !!segment.styleOverride && Object.keys(segment.styleOverride).length > 0

  const save = () => {
    updateSegment(segment.id, { text: editText })
    setIsEditing(false)
  }

  // 選択範囲をタグで囲む。未選択なら全体を囲む
  const wrapSelection = (open: string, close: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const [a, b] = start === end ? [0, editText.length] : [start, end]
    const next = editText.slice(0, a) + open + editText.slice(a, b) + close + editText.slice(b)
    setEditText(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(a + open.length, b + open.length)
    })
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
          {hasOverride && (
            <span className="text-[10px] text-purple-400 border border-purple-800 rounded-full px-1.5" title="個別デザイン設定あり">
              🎨
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="text-xs text-gray-500 hover:text-white px-2 py-0.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={(e) => { e.stopPropagation(); splitSegment(segment.id, currentTime) }}
            disabled={!canSplit}
            title="再生位置で分割"
          >
            分割
          </button>
          <button
            className="text-xs text-gray-500 hover:text-white px-2 py-0.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={(e) => { e.stopPropagation(); mergeWithNext(segment.id) }}
            disabled={isLast}
            title="次の字幕と結合"
          >
            結合
          </button>
          <button
            className={`text-xs px-2 py-0.5 rounded ${showDesign ? 'text-purple-300' : 'text-gray-500 hover:text-white'}`}
            onClick={(e) => { e.stopPropagation(); setShowDesign(!showDesign) }}
            title="この字幕だけのデザイン"
          >
            🎨
          </button>
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
          {/* 部分装飾ツールバー: 選択した文字に適用（未選択なら全体） */}
          <div className="flex flex-wrap items-center gap-1">
            {PART_COLORS.map((c) => (
              <button
                key={c}
                className="w-5 h-5 rounded-full border border-gray-600 hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
                onClick={() => wrapSelection(`<c=${c}>`, '</c>')}
                title={`選択文字を ${c} に`}
              />
            ))}
            <input
              type="color"
              className="w-6 h-6 rounded bg-gray-800 border border-gray-600 cursor-pointer"
              onChange={(e) => wrapSelection(`<c=${e.target.value.toUpperCase()}>`, '</c>')}
              title="選択文字を任意の色に"
            />
            <span className="w-px h-4 bg-gray-700 mx-0.5" />
            {PART_SIZES.map((sz) => (
              <button
                key={sz.value}
                className="text-[11px] px-1.5 py-0.5 rounded border border-gray-600 text-gray-300 hover:border-gray-400"
                onClick={() => wrapSelection(`<s=${sz.value}>`, '</s>')}
              >
                {sz.label}
              </button>
            ))}
            <button
              className="text-[11px] px-1.5 py-0.5 rounded border border-gray-600 text-gray-300 font-bold hover:border-gray-400"
              onClick={() => wrapSelection('<b>', '</b>')}
            >
              B
            </button>
            <span className="w-px h-4 bg-gray-700 mx-0.5" />
            <button
              className="text-[11px] px-1.5 py-0.5 rounded border border-gray-600 text-gray-400 hover:border-gray-400"
              onClick={() => setEditText(stripRichTags(editText))}
              title="装飾をすべて解除"
            >
              解除
            </button>
          </div>

          <textarea
            ref={textareaRef}
            className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm resize-none border border-gray-700 focus:border-blue-500 outline-none"
            rows={3}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            autoFocus
          />
          <p className="text-[10px] text-gray-600">
            文字を選択して色/サイズ/Bボタンで部分装飾。Enterで改行位置を指定できます。
          </p>

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
        <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
          <RichText spans={parseRichText(segment.text)} />
        </p>
      )}

      {/* 個別デザインパネル */}
      {showDesign && (
        <div onClick={(e) => e.stopPropagation()}>
          <SegmentStylePanel segment={segment} />
        </div>
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
