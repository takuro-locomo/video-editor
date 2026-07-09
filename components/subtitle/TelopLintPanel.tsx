'use client'
import { useMemo } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { lintProject, LintFinding } from '@/lib/telop-lint'
import {
  convertPunctuation,
  detectEmphasisRuns,
  detectParticleRuns,
  autoAdjustTiming,
  removeFillers,
} from '@/lib/telop-text'
import { formatTime } from '@/lib/time-utils'

const RULE_ICON: Record<LintFinding['rule'], string> = {
  'reading-speed': '⏱',
  'line-length': '↔',
  'line-count': '☰',
  'total-chars': '🔤',
  punctuation: '、',
  'style-variety': '🎨',
  'safe-zone': '🛟',
}

function ActionButton({
  label,
  desc,
  onClick,
  disabled,
}: {
  label: string
  desc: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left px-3 py-2 rounded-lg border border-gray-800 bg-gray-900 hover:border-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span className="text-xs text-gray-200 font-medium block">{label}</span>
      <span className="text-[10px] text-gray-500 block mt-0.5">{desc}</span>
    </button>
  )
}

/**
 * テロップLintパネル（F-01/F-02/F-04/F-05のチェック結果と、
 * F-07/F-08/F-10/F-11 のワンタップ自動処理）。
 */
export function TelopLintPanel() {
  const {
    segments,
    subtitleStyle,
    outputSettings,
    naturalWidth,
    naturalHeight,
    duration,
    safeZonePreset,
    emphasisColor,
    setEmphasisColor,
    viewerCheckMode,
    setViewerCheckMode,
    setCurrentTime,
    updateSegment,
    bulkUpdateSegments,
    clearAllSegmentStyleOverrides,
  } = useEditorStore()

  // 出力フレーム寸法（アスペクト比変更を反映）
  const frame = useMemo(() => {
    const w = naturalWidth || 1920
    const h = naturalHeight || 1080
    switch (outputSettings.aspect) {
      case '9:16': return { w: Math.round(h * (9 / 16)), h }
      case '1:1': return { w: h, h }
      case '16:9': return { w: Math.round(h * (16 / 9)), h }
      default: return { w, h }
    }
  }, [naturalWidth, naturalHeight, outputSettings.aspect])

  const findings = useMemo(
    () =>
      lintProject(segments, subtitleStyle, {
        frameWidth: frame.w,
        frameHeight: frame.h,
        isVertical: frame.h > frame.w,
        duration,
        safeZonePreset,
        viewerMode: viewerCheckMode,
      }),
    [segments, subtitleStyle, frame, duration, safeZonePreset, viewerCheckMode]
  )

  const warnCount = findings.filter((f) => f.level === 'warn').length
  const segById = useMemo(
    () => new Map(segments.map((s) => [s.id, s])),
    [segments]
  )

  const applyFix = (f: LintFinding) => {
    if (f.fix === 'extend' && f.segmentId && f.suggestedEndTime) {
      updateSegment(f.segmentId, { endTime: f.suggestedEndTime })
    } else if (f.fix === 'punctuation' && f.segmentId) {
      const seg = segById.get(f.segmentId)
      if (seg) {
        // テキストが変わるため文字インデックス基準のインライン装飾はリセット
        updateSegment(f.segmentId, { text: convertPunctuation(seg.text), styleRuns: undefined })
      }
    } else if (f.fix === 'unify-style') {
      clearAllSegmentStyleOverrides()
    }
  }

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
        <div className="text-4xl">✅</div>
        <p className="text-gray-400 text-sm">字幕を作成すると、見やすさの<br />自動チェックが表示されます</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full p-3 space-y-4">
      {/* ワンタップ自動処理 */}
      <div className="space-y-1.5">
        <p className="text-xs text-gray-400 font-medium px-1">ワンタップ処理（全テロップ）</p>
        <ActionButton
          label="、。→ スペースに変換"
          desc="句読点をスペースに置き換える字幕の業界慣習（F-11）"
          onClick={() =>
            bulkUpdateSegments((segs) =>
              segs.map((s) =>
                /[、。]/.test(s.text)
                  ? { ...s, text: convertPunctuation(s.text), styleRuns: undefined }
                  : s
              )
            )
          }
        />
        <ActionButton
          label="キーワード自動強調"
          desc="数字・重要語を検出して色＋太字＋115%に（1テロップ最大2箇所）"
          onClick={() =>
            bulkUpdateSegments((segs) =>
              segs.map((s) => {
                const runs = detectEmphasisRuns(s.text, emphasisColor, s.styleRuns ?? [])
                if (!runs.length) return s
                return { ...s, styleRuns: [...(s.styleRuns ?? []), ...runs] }
              })
            )
          }
        />
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] text-gray-500">強調色（プロジェクトで1色）</span>
          <input
            type="color"
            value={emphasisColor}
            onChange={(e) => setEmphasisColor(e.target.value)}
            className="w-8 h-6 rounded bg-gray-900 border border-gray-800 cursor-pointer"
          />
          {(['#FFE600', '#FF3B30'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setEmphasisColor(c)}
              className={`w-5 h-5 rounded-full border ${emphasisColor === c ? 'border-white' : 'border-gray-700'}`}
              style={{ backgroundColor: c }}
              title={c === '#FFE600' ? '黄' : '赤'}
            />
          ))}
        </div>
        <ActionButton
          label="助詞・単位を小さく（テレビ風）"
          desc="「〜を」「円」「さん」等を85%に自動縮小（F-08）"
          onClick={() =>
            bulkUpdateSegments((segs) =>
              segs.map((s) => {
                const runs = detectParticleRuns(s.text, s.styleRuns ?? [])
                if (!runs.length) return s
                return { ...s, styleRuns: [...(s.styleRuns ?? []), ...runs] }
              })
            )
          }
        />
        <ActionButton
          label="フィラーを除去"
          desc="「えっと」「あのー」等の言いよどみを削除（要約支援）"
          onClick={() =>
            bulkUpdateSegments((segs) =>
              segs.map((s) => {
                const cleaned = removeFillers(s.text)
                if (cleaned === s.text) return s
                // テキストが変わるため文字インデックス基準のインライン装飾はリセット
                return { ...s, text: cleaned, styleRuns: undefined }
              })
            )
          }
        />
        <ActionButton
          label="タイミング自動調整"
          desc="表示を2フレーム先行・話し終わりから1秒後に消す（F-10）"
          onClick={() => bulkUpdateSegments((segs) => autoAdjustTiming(segs, duration))}
        />
        <p className="text-[10px] text-gray-600 px-1">すべて Ctrl+Z で元に戻せます</p>
      </div>

      {/* チェック結果 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-gray-400 font-medium">チェック結果</p>
          <span className={`text-xs font-medium ${warnCount ? 'text-amber-400' : 'text-green-400'}`}>
            {warnCount ? `⚠ ${warnCount}件の警告` : '✓ 問題なし'}
          </span>
        </div>
        {/* F-01/R-05 視聴者モード: 編集者は内容を知っているため速く読めてしまう */}
        <button
          onClick={() => setViewerCheckMode(!viewerCheckMode)}
          className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
            viewerCheckMode
              ? 'border-blue-500 bg-blue-950/40 text-white'
              : 'border-gray-800 bg-gray-900 text-gray-400'
          }`}
        >
          <span className="text-xs font-medium block">
            👀 視聴者モード {viewerCheckMode ? 'ON' : 'OFF'}
          </span>
          <span className="text-[10px] text-gray-500 block mt-0.5">
            編集者は内容を知っているため速く読めます。ONで読了時間を1.5倍厳しめに判定（R-05）
          </span>
        </button>

        {findings.length === 0 && (
          <p className="text-xs text-gray-600 px-1 py-2">
            読了時間・文字数・スタイル統一のチェックをすべてパスしています。
          </p>
        )}

        {findings.map((f, i) => {
          const seg = f.segmentId ? segById.get(f.segmentId) : undefined
          return (
            <div
              key={i}
              className={`rounded-lg border p-2.5 ${
                f.level === 'warn'
                  ? 'border-amber-900/60 bg-amber-950/20'
                  : 'border-gray-800 bg-gray-900'
              } ${seg ? 'cursor-pointer hover:border-gray-600' : ''}`}
              onClick={() => seg && setCurrentTime(seg.startTime)}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm leading-none mt-0.5">{RULE_ICON[f.rule]}</span>
                <div className="flex-1 min-w-0">
                  {seg && (
                    <p className="text-[10px] text-blue-400 font-mono mb-0.5">
                      {formatTime(seg.startTime)}
                      <span className="text-gray-500 font-sans">
                        {seg.text.slice(0, 15)}{seg.text.length > 15 ? '…' : ''}
                      </span>
                    </p>
                  )}
                  <p className={`text-xs ${f.level === 'warn' ? 'text-amber-200' : 'text-gray-400'}`}>
                    {f.message}
                  </p>
                </div>
                {f.fix && (
                  <button
                    onClick={(e) => { e.stopPropagation(); applyFix(f) }}
                    className="text-[10px] px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-200 hover:border-gray-500 flex-shrink-0"
                  >
                    {f.fix === 'extend' ? '延長' : f.fix === 'punctuation' ? '変換' : '統一'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
