'use client'
import { useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { SubtitleFontFamily, SubtitleSegment } from '@/types/subtitle'
import { formatTime } from '@/lib/time-utils'
import { applyRunPatch, RunProps } from '@/lib/style-runs'

const FONT_OPTIONS: { value: SubtitleFontFamily; label: string }[] = [
  { value: 'gothic', label: 'ゴシック' },
  { value: 'mincho', label: '明朝' },
  { value: 'notosans', label: 'Noto' },
  { value: 'maru', label: '丸ゴ' },
]

const SIZE_OPTIONS = [
  { label: '×1.2', value: 1.2 },
  { label: '×1.5', value: 1.5 },
  { label: '×2.0', value: 2.0 },
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
    resetSegmentStyleKey,
    updateSegmentRuns,
    deleteSegment,
    requestSeek,
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

  // 選択範囲に装飾を合成適用（既存の装飾は保持しつつ上書き。大きく＋色などの併用が可能）
  const applyToSelection = (patch: RunProps | null) => {
    if (!selection) return
    // テキストが書き換えられていたら先に確定する（装飾位置とテキストのズレを防ぐ）
    const textChanged = editText !== segment.text
    const baseRuns = textChanged ? [] : segment.styleRuns ?? []
    const runs = applyRunPatch(editText.length, baseRuns, selection.from, selection.to, patch)
    if (textChanged) {
      updateSegment(segment.id, { text: editText, styleRuns: runs.length ? runs : undefined })
    } else {
      updateSegmentRuns(segment.id, runs)
    }
    // 選択は維持する（続けて別の装飾を掛けられるように）
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
            onClick={(e) => { e.stopPropagation(); requestSeek(segment.startTime + 0.01) }}
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
              const entering = !isEditing
              setIsEditing(entering)
              setEditText(segment.text)
              setSelection(null)
              // 編集を始めたらプレビューをこの字幕の位置へ（編集結果をリアルタイム確認）
              if (entering) requestSeek(segment.startTime + 0.01)
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

          {/* フォント */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400">フォント</label>
              {segment.styleOverride?.fontFamily !== undefined ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded">個別</span>
                  <button
                    onClick={() => resetSegmentStyleKey(segment.id, 'fontFamily')}
                    className="text-[10px] text-gray-500 hover:text-gray-300"
                    title="グローバル設定に戻す"
                  >↺ 全体に戻す</button>
                </div>
              ) : (
                <span className="text-[10px] text-gray-600">全体設定を使用中</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => updateSegmentStyle(segment.id, { fontFamily: f.value })}
                  className={`text-xs py-1.5 rounded border transition-colors ${
                    eff.fontFamily === f.value
                      ? segment.styleOverride?.fontFamily !== undefined
                        ? 'border-purple-500 bg-purple-950 text-white'
                        : 'border-blue-400/60 bg-blue-950/30 text-blue-200'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >{f.label}</button>
              ))}
            </div>
          </div>

          {/* 文字色 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400">文字色</label>
              {segment.styleOverride?.textColor !== undefined ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded">個別</span>
                  <button
                    onClick={() => resetSegmentStyleKey(segment.id, 'textColor')}
                    className="text-[10px] text-gray-500 hover:text-gray-300"
                  >↺ 全体に戻す</button>
                </div>
              ) : (
                <span className="text-[10px] text-gray-600">全体設定を使用中</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={eff.textColor}
                onChange={(e) => updateSegmentStyle(segment.id, { textColor: e.target.value })}
                className="w-10 h-8 rounded cursor-pointer bg-transparent border border-gray-700 p-0.5"
              />
              <span className={`text-xs font-mono ${segment.styleOverride?.textColor !== undefined ? 'text-purple-300' : 'text-gray-500'}`}>
                {eff.textColor}
              </span>
            </div>
          </div>

          {/* 文字サイズ */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400">
                文字サイズ（{eff.fontSizePercent}%）
              </label>
              {segment.styleOverride?.fontSizePercent !== undefined ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded">個別</span>
                  <button
                    onClick={() => resetSegmentStyleKey(segment.id, 'fontSizePercent')}
                    className="text-[10px] text-gray-500 hover:text-gray-300"
                  >↺ 全体に戻す</button>
                </div>
              ) : (
                <span className="text-[10px] text-gray-600">全体設定を使用中</span>
              )}
            </div>
            <input
              type="range" min={3} max={12} step={0.5}
              value={eff.fontSizePercent}
              onChange={(e) => updateSegmentStyle(segment.id, { fontSizePercent: Number(e.target.value) })}
              className={`w-full ${segment.styleOverride?.fontSizePercent !== undefined ? 'accent-purple-500' : 'accent-blue-600'}`}
            />
          </div>

          {/* 太字 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400">太字</label>
              {segment.styleOverride?.bold !== undefined ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded">個別</span>
                  <button
                    onClick={() => resetSegmentStyleKey(segment.id, 'bold')}
                    className="text-[10px] text-gray-500 hover:text-gray-300"
                  >↺ 全体に戻す</button>
                </div>
              ) : (
                <span className="text-[10px] text-gray-600">全体設定を使用中</span>
              )}
            </div>
            <button
              onClick={() => updateSegmentStyle(segment.id, { bold: !eff.bold })}
              className={`w-full text-xs py-1.5 rounded border transition-colors ${
                eff.bold
                  ? segment.styleOverride?.bold !== undefined
                    ? 'border-purple-500 bg-purple-950 text-white'
                    : 'border-blue-400/60 bg-blue-950/30 text-blue-200'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >太字 {eff.bold ? 'ON' : 'OFF'}</button>
          </div>

          {/* 背景（このテロップだけ座布団を敷く/色を変える） */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400">背景</label>
              {segment.styleOverride?.backgroundEnabled !== undefined ||
              segment.styleOverride?.backgroundColor !== undefined ||
              segment.styleOverride?.backgroundOpacity !== undefined ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded">個別</span>
                  <button
                    onClick={() => {
                      resetSegmentStyleKey(segment.id, 'backgroundEnabled')
                      resetSegmentStyleKey(segment.id, 'backgroundColor')
                      resetSegmentStyleKey(segment.id, 'backgroundOpacity')
                    }}
                    className="text-[10px] text-gray-500 hover:text-gray-300"
                    title="グローバル設定に戻す"
                  >↺ 全体に戻す</button>
                </div>
              ) : (
                <span className="text-[10px] text-gray-600">全体設定を使用中</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSegmentStyle(segment.id, { backgroundEnabled: !eff.backgroundEnabled })}
                className={`text-xs px-2.5 py-1.5 rounded border transition-colors flex-shrink-0 ${
                  eff.backgroundEnabled
                    ? segment.styleOverride?.backgroundEnabled !== undefined
                      ? 'border-purple-500 bg-purple-950 text-white'
                      : 'border-blue-400/60 bg-blue-950/30 text-blue-200'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >背景 {eff.backgroundEnabled ? 'ON' : 'OFF'}</button>
              {eff.backgroundEnabled && (
                <>
                  <input
                    type="color"
                    value={eff.backgroundColor}
                    onChange={(e) => updateSegmentStyle(segment.id, { backgroundColor: e.target.value })}
                    className="w-10 h-8 rounded cursor-pointer bg-transparent border border-gray-700 p-0.5"
                    title="背景色"
                  />
                  <input
                    type="range" min={0.1} max={1} step={0.05}
                    value={eff.backgroundOpacity}
                    onChange={(e) => updateSegmentStyle(segment.id, { backgroundOpacity: Number(e.target.value) })}
                    className="flex-1 accent-purple-500"
                    title={`不透明度 ${Math.round(eff.backgroundOpacity * 100)}%`}
                  />
                </>
              )}
            </div>
          </div>

          {/* 全項目リセット（個別設定がある場合のみ表示） */}
          {hasOverride && (
            <button
              onClick={() => updateSegmentStyle(segment.id, null)}
              className="w-full text-xs py-1.5 rounded border border-red-900/60 text-red-400 hover:text-red-300 hover:border-red-800 transition-colors"
            >すべての個別設定を全体に戻す</button>
          )}

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
                  {run.bold && <span className="text-xs text-gray-300 font-bold">B</span>}
                  {run.color && (
                    <span
                      className="w-4 h-4 rounded-full inline-block border border-gray-600 flex-shrink-0"
                      style={{ backgroundColor: run.color }}
                      title="文字色"
                    />
                  )}
                  {run.backgroundColor && (
                    <span
                      className="w-4 h-4 rounded-sm inline-block border border-gray-600 flex-shrink-0"
                      style={{ backgroundColor: run.backgroundColor }}
                      title="背景色"
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

          {/* 選択時のインライン装飾バー（装飾は合成される: 大きく＋色＋背景の併用OK） */}
          {selection && (
            <div className="space-y-1.5 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-400 block truncate">
                「{editText.slice(selection.from, selection.to)}」を装飾（組み合わせ可）
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {SIZE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onMouseDown={(e) => { e.preventDefault(); applyToSelection({ sizeMultiplier: o.value }) }}
                    className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-0.5 rounded flex-shrink-0"
                    title={`文字を${o.label}に拡大`}
                  >A{o.label}</button>
                ))}
                <button
                  onMouseDown={(e) => { e.preventDefault(); applyToSelection({ bold: true }) }}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-white font-bold px-2.5 py-0.5 rounded flex-shrink-0"
                  title="部分太字"
                >B</button>
                <label
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-0.5 rounded cursor-pointer flex-shrink-0 relative"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  文字色
                  <input
                    type="color"
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    defaultValue="#FFD700"
                    onInput={(e) => applyToSelection({ color: (e.target as HTMLInputElement).value })}
                  />
                </label>
                <label
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-0.5 rounded cursor-pointer flex-shrink-0 relative"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  背景
                  <input
                    type="color"
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    defaultValue="#E11D48"
                    onInput={(e) => applyToSelection({ backgroundColor: (e.target as HTMLInputElement).value })}
                  />
                </label>
                <button
                  onMouseDown={(e) => { e.preventDefault(); applyToSelection(null); setSelection(null) }}
                  className="text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded border border-gray-700 flex-shrink-0"
                  title="選択範囲の装飾をすべて解除"
                >解除</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-400">
              開始: {formatTime(segment.startTime)}
              <input
                type="range" min={0} max={segment.endTime - 0.1} step={0.1}
                value={segment.startTime}
                onChange={(e) => {
                  const t = Number(e.target.value)
                  updateSegment(segment.id, { startTime: t })
                  requestSeek(t + 0.01) // 動かしながらプレビューで確認できるように
                }}
                className="w-full mt-1 accent-blue-500"
              />
            </label>
            <label className="text-xs text-gray-400">
              終了: {formatTime(segment.endTime)}
              <input
                type="range" min={segment.startTime + 0.1} max={segment.startTime + 30} step={0.1}
                value={segment.endTime}
                onChange={(e) => {
                  const t = Number(e.target.value)
                  updateSegment(segment.id, { endTime: t })
                  requestSeek(Math.max(segment.startTime, t - 0.01))
                }}
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
          onClick={() => useEditorStore.getState().requestSeek(seg.startTime + 0.01)}
        />
      ))}
    </div>
  )
}
