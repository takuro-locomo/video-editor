import {
  SubtitleSegment,
  SubtitleStyle,
  SafeZonePresetKey,
} from '@/types/subtitle'
import { computeEffectiveMaxChars, wrapText, mergeStyle } from './subtitle-style'
import { TELOP_RULES, IDIOM_WHITELIST, SAFE_ZONE_PRESETS, ZoneRect } from './telop-rules'

export type LintRule =
  | 'reading-speed'   // F-01
  | 'line-length'     // F-02 (R-06/R-07)
  | 'line-count'      // F-02 (R-08)
  | 'total-chars'     // F-02 (R-09)
  | 'punctuation'     // F-02/F-11
  | 'style-variety'   // F-05
  | 'safe-zone'       // F-04

export interface LintFinding {
  rule: LintRule
  level: 'warn' | 'info'
  message: string
  segmentId?: string // undefined = プロジェクト全体の指摘
  /** 'extend' なら「◯秒に延長」クイックフィックスが可能 */
  fix?: 'extend' | 'punctuation' | 'unify-style'
  /** fix='extend' のときの推奨 endTime（秒） */
  suggestedEndTime?: number
}

export interface LintContext {
  frameWidth: number
  frameHeight: number
  /** 縦型（9:16など高さ>幅）かどうか。1行文字数の基準が変わる（R-06/R-07） */
  isVertical: boolean
  duration: number
  safeZonePreset: SafeZonePresetKey
  /** F-01/R-05 視聴者モード: 編集者体感の1.5倍で読了時間を判定 */
  viewerMode?: boolean
}

/** 読了時間の計算対象となる文字数（空白・記号を除く） */
function readableCharCount(text: string): number {
  return Array.from(text.replace(/[\s、。「」『』（）()!！?？・…]/g, '')).length
}

/** F-01 読了時間チェック */
function lintReadingSpeed(
  seg: SubtitleSegment,
  nextStart: number | null,
  duration: number,
  viewerMode: boolean
): LintFinding | null {
  const chars = readableCharCount(seg.text)
  if (chars === 0) return null
  // R-04 慣用句は塊で認識できるため緩和
  const trimmed = seg.text.trim()
  if (IDIOM_WHITELIST.some((idiom) => trimmed === idiom || trimmed === `${idiom}！` || trimmed === `${idiom}!`)) {
    return null
  }
  // R-05 視聴者モード: 編集者は内容を知っているため、視聴者の読む速さは体感の1.5倍かかるとみなす
  const factor = viewerMode ? TELOP_RULES.viewerFactor : 1
  const charsPerSec = TELOP_RULES.readingCharsPerSec / factor
  const required = chars / charsPerSec
  const actual = seg.endTime - seg.startTime
  if (actual >= required) return null

  const shortage = required - actual
  let suggested = seg.startTime + required
  if (nextStart !== null) suggested = Math.min(suggested, nextStart - 0.01)
  if (duration > 0) suggested = Math.min(suggested, duration)
  const canExtend = suggested > seg.endTime + 0.05

  return {
    rule: 'reading-speed',
    level: 'warn',
    segmentId: seg.id,
    message: `読み切れない可能性（${chars}文字/${actual.toFixed(1)}秒${viewerMode ? '・視聴者モード' : ''}）。あと${shortage.toFixed(1)}秒延長 or ${Math.ceil(shortage * charsPerSec)}文字削減を推奨`,
    ...(canExtend ? { fix: 'extend' as const, suggestedEndTime: Math.round(suggested * 100) / 100 } : {}),
  }
}

/** F-02 文字数リント（1行文字数・行数・総文字数・句読点） */
function lintCharCounts(
  seg: SubtitleSegment,
  style: SubtitleStyle,
  ctx: LintContext
): LintFinding[] {
  const findings: LintFinding[] = []
  const eff = mergeStyle(style, seg.styleOverride)
  const maxChars = computeEffectiveMaxChars(
    ctx.frameWidth, ctx.frameHeight, eff.fontSizePercent, eff.maxCharsPerLine
  )
  const lines = wrapText(seg.text, maxChars).split('\n')
  const lineLimit = ctx.isVertical ? TELOP_RULES.maxCharsPerLineV : TELOP_RULES.maxCharsPerLineH

  const longest = Math.max(...lines.map((l) => Array.from(l).length))
  if (longest > lineLimit) {
    findings.push({
      rule: 'line-length',
      level: 'warn',
      segmentId: seg.id,
      message: `1行${longest}文字（推奨${lineLimit}文字以内${ctx.isVertical ? '・縦型' : ''}）。改行 or 分割を推奨`,
    })
  }
  if (lines.length > TELOP_RULES.maxLines) {
    findings.push({
      rule: 'line-count',
      level: 'warn',
      segmentId: seg.id,
      message: `${lines.length}行表示（推奨は最大${TELOP_RULES.maxLines}行）。テロップの分割を推奨`,
    })
  }
  const total = readableCharCount(seg.text)
  if (total > TELOP_RULES.maxTotalChars) {
    findings.push({
      rule: 'total-chars',
      level: 'warn',
      segmentId: seg.id,
      message: `1画面${total}文字（推奨${TELOP_RULES.maxTotalChars}文字以内）。超えると「読み物」になります`,
    })
  }
  if (/[、。]/.test(seg.text)) {
    findings.push({
      rule: 'punctuation',
      level: 'info',
      segmentId: seg.id,
      message: '句読点（、。）はスペースへの置換が字幕の慣習です',
      fix: 'punctuation',
    })
  }
  return findings
}

/** F-05 スタイル統一チェック：フォント×色×装飾の組合せ数をカウント */
function lintStyleVariety(
  segments: SubtitleSegment[],
  style: SubtitleStyle
): LintFinding | null {
  const keys = new Set(
    segments.map((seg) => {
      const eff = mergeStyle(style, seg.styleOverride)
      return [
        eff.fontFamily, eff.textColor, eff.bold, eff.outline,
        eff.outlineColor, eff.backgroundEnabled, eff.backgroundColor,
      ].join('|')
    })
  )
  if (keys.size <= TELOP_RULES.maxStyleVariants) return null
  return {
    rule: 'style-variety',
    level: 'warn',
    message: `テロップスタイルが${keys.size}種類あります（推奨${TELOP_RULES.maxStyleVariants}以内）。1本を通して統一し、強調だけ変えるのが基本です`,
    fix: 'unify-style',
  }
}

/** 2つの%矩形が重なるか */
function rectsOverlap(a: ZoneRect, b: ZoneRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/**
 * F-04 セーフゾーン判定：テロップの推定表示領域がNGゾーンにかかっていないか。
 * 表示位置・行数・フォントサイズから矩形を幾何計算で推定する。
 */
function lintSafeZone(
  seg: SubtitleSegment,
  style: SubtitleStyle,
  ctx: LintContext
): LintFinding | null {
  if (ctx.safeZonePreset === 'off' || ctx.safeZonePreset === 'landscape') return null
  const preset = SAFE_ZONE_PRESETS[ctx.safeZonePreset]
  if (!preset?.ngZones.length || !ctx.frameWidth || !ctx.frameHeight) return null

  const eff = mergeStyle(style, seg.styleOverride)
  const maxChars = computeEffectiveMaxChars(
    ctx.frameWidth, ctx.frameHeight, eff.fontSizePercent, eff.maxCharsPerLine
  )
  const lines = wrapText(seg.text, maxChars).split('\n')
  const longest = Math.max(...lines.map((l) => Array.from(l).length), 1)

  // テロップ矩形の推定（%）: 全角1文字 ≒ fontSize幅、行送り1.35
  const fontHpct = eff.fontSizePercent
  const boxHpct = lines.length * fontHpct * 1.35
  const fontPx = (fontHpct / 100) * ctx.frameHeight
  const boxWpct = Math.min(100, (longest * fontPx / ctx.frameWidth) * 100)
  const x = (100 - boxWpct) / 2
  const marginV = 6 // プレビュー・書き出しと同じ上下マージン
  let y: number
  if (eff.position === 'top') y = 5
  else if (eff.position === 'middle') y = 50 - boxHpct / 2
  else y = 100 - marginV - boxHpct

  const box: ZoneRect = { x, y, w: boxWpct, h: boxHpct }
  const hit = preset.ngZones.find((z) => rectsOverlap(box, z))
  if (!hit) return null
  return {
    rule: 'safe-zone',
    level: 'warn',
    segmentId: seg.id,
    message: `${preset.label}の「${hit.label}」にテロップがかかっています。表示位置の変更を推奨`,
  }
}

/** プロジェクト全体のテロップLintを実行 */
export function lintProject(
  segments: SubtitleSegment[],
  style: SubtitleStyle,
  ctx: LintContext
): LintFinding[] {
  const findings: LintFinding[] = []
  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime)

  sorted.forEach((seg, i) => {
    const nextStart = i < sorted.length - 1 ? sorted[i + 1].startTime : null
    const reading = lintReadingSpeed(seg, nextStart, ctx.duration, ctx.viewerMode ?? false)
    if (reading) findings.push(reading)
    findings.push(...lintCharCounts(seg, style, ctx))
    const zone = lintSafeZone(seg, style, ctx)
    if (zone) findings.push(zone)
  })

  const variety = lintStyleVariety(segments, style)
  if (variety) findings.push(variety)

  return findings
}
