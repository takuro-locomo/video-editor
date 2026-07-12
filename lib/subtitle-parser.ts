import { SubtitleSegment, SubtitleStyle, StyleRun } from '@/types/subtitle'
import { secondsToSrtTime } from './time-utils'
import {
  fontFamilyToAss,
  hexToAssColor,
  hexToAssColorInline,
  wrapText,
  computeEffectiveMaxChars,
  mergeStyle,
  LATIN_FONT_PAIRS,
} from './subtitle-style'

/** SubtitleSegment[] を SRT 文字列に変換 */
export function segmentsToSrt(segments: SubtitleSegment[]): string {
  return segments
    .map((seg, i) => {
      const start = secondsToSrtTime(seg.startTime)
      const end = secondsToSrtTime(seg.endTime)
      return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`
    })
    .join('\n')
}

/** 秒数を ASS タイムコード形式に変換 (例: 3661.5 → "1:01:01.50") */
function secondsToAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.round((seconds % 1) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

/** ASS の Text フィールド用にエスケープ（改行→\N、波括弧は全角に置換） */
function escapeAssText(text: string): string {
  return text
    .replace(/[{}]/g, (c) => (c === '{' ? '｛' : '｝'))
    .replace(/\r?\n/g, '\\N')
}

/**
 * 折り返し後テキストの各文字が、元テキストの何文字目に対応するかのマッピングを構築。
 * wrapText は \n を挿入するだけで文字を削除/並べ替えないことを前提とする。
 */
function buildOrigToWrappedMap(orig: string, wrapped: string): number[] {
  const map: number[] = new Array(orig.length + 1).fill(wrapped.length)
  let wi = 0
  for (let oi = 0; oi <= orig.length; oi++) {
    while (wi < wrapped.length && wrapped[wi] === '\n') wi++
    map[oi] = wi
    if (oi < orig.length) wi++
  }
  return map
}

/** applyRunsToAss で部分背景を再現するための基準値 */
type RunAssContext = {
  /** ベースの縁取り太さ(px)。ラン終了時に戻す */
  outlinePx: number
  /** BorderStyle=3（不透明ボックス背景）モードか。boxモードでは \3c がボックス色になる */
  boxMode: boolean
  /** ベースの縁取り色（boxモードでは背景色）。ラン終了時に戻す */
  outlineColorHex: string
}

/**
 * スタイルランを考慮した ASS テキストを生成。
 * 折り返し済みテキストの適切な位置に \fs・\c タグを挿入し、ラン終了後はベースに戻す。
 * 部分背景(backgroundColor)は、背景ボックスあり(BorderStyle=3)ならボックス色の変更、
 * なしなら太い縁取りによるマーカー風ハイライトで近似する。
 */
function applyRunsToAss(
  orig: string,
  runs: StyleRun[],
  baseFontPx: number,
  baseColor: string,
  baseBold: boolean,
  effectiveMaxChars: number,
  ctx: RunAssContext
): string {
  const wrapped = wrapText(orig, effectiveMaxChars)
  const validRuns = runs
    .filter((r) => r.from < r.to && r.from >= 0 && r.to <= orig.length)
    .sort((a, b) => a.from - b.from)

  if (!validRuns.length) return escapeAssText(wrapped)

  const map = buildOrigToWrappedMap(orig, wrapped)
  const wChars = [...wrapped]

  const escapeContent = (s: string) =>
    s.replace(/[{}]/g, (c) => (c === '{' ? '｛' : '｝')).replace(/\n/g, '\\N')

  let result = ''
  let wi = 0
  for (const run of validRuns) {
    const wFrom = map[run.from]
    const wTo = map[Math.min(run.to, orig.length)]
    result += escapeContent(wChars.slice(wi, wFrom).join(''))
    const open: string[] = []
    if (run.sizeMultiplier) open.push(`\\fs${Math.round(baseFontPx * run.sizeMultiplier)}`)
    if (run.color) open.push(`\\c${hexToAssColorInline(run.color)}`)
    if (run.bold) open.push('\\b1')
    if (run.backgroundColor) {
      if (!ctx.boxMode) open.push(`\\bord${Math.max(3, Math.round(baseFontPx * 0.18))}`)
      open.push(`\\3c${hexToAssColorInline(run.backgroundColor)}`)
    }
    if (open.length) result += `{${open.join('')}}`
    result += escapeContent(wChars.slice(wFrom, wTo).join(''))
    const close: string[] = []
    if (run.sizeMultiplier) close.push(`\\fs${baseFontPx}`)
    if (run.color) close.push(`\\c${hexToAssColorInline(baseColor)}`)
    if (run.bold) close.push(`\\b${baseBold ? 1 : 0}`)
    if (run.backgroundColor) {
      if (!ctx.boxMode) close.push(`\\bord${ctx.outlinePx}`)
      close.push(`\\3c${hexToAssColorInline(ctx.outlineColorHex)}`)
    }
    if (close.length) result += `{${close.join('')}}`
    wi = wTo
  }
  result += escapeContent(wChars.slice(wi).join(''))
  return result
}

/**
 * F-09 和欧混植: エスケープ済みASSテキスト内の英数字の連なりを
 * {\fn欧文}〜{\fn和文} で挟んで欧文フォントに差し替える。
 * {...} は既存のスタイルタグ、\N は改行タグなので中身に手を付けない
 * （escapeAssText が本文中の { } を全角に置換済みのため、残る { } はすべてタグ）。
 */
function applyLatinFontToAss(assText: string, latinFont: string, baseFont: string): string {
  // 英数字とその間の区切り記号（空白・ピリオド等）を1つの欧文ランとして扱う
  const latinRunRe = /[A-Za-z0-9](?:[A-Za-z0-9 .,'%:&+\-]*[A-Za-z0-9%])?/g
  const wrapLatin = (content: string) =>
    content.replace(latinRunRe, (m) => `{\\fn${latinFont}}${m}{\\fn${baseFont}}`)
  return assText
    .split(/(\{[^}]*\})/) // タグ部分はそのまま通す
    .map((part) =>
      part.startsWith('{')
        ? part
        : part.split('\\N').map(wrapLatin).join('\\N') // \N の N を英字として拾わない
    )
    .join('')
}

/** 位置 → ASS の Alignment(numpad)。中央寄せ: top=8, middle=5, bottom=2 */
function positionToAlignment(position: SubtitleStyle['position']): number {
  return position === 'top' ? 8 : position === 'middle' ? 5 : 2
}

/** ASS の Style 行と、イベント生成に必要な計算済みパラメータ */
function computeAssStyleParams(s: SubtitleStyle, width: number, height: number) {
  const fontName = fontFamilyToAss(s.fontFamily)
  const fontSize = Math.round((s.fontSizePercent / 100) * height)
  const primary = hexToAssColor(s.textColor, 1)
  // libass の BorderStyle=3（不透明ボックス）はボックスを OutlineColour で描画するため、
  // 背景ありのときは OutlineColour に背景色+不透明度を入れる（ベタ塗りバグの修正）
  const outlineColorHex = s.backgroundEnabled ? s.backgroundColor : s.outlineColor ?? '#000000'
  const outlineColour = s.backgroundEnabled
    ? hexToAssColor(s.backgroundColor, s.backgroundOpacity)
    : hexToAssColor(outlineColorHex, 1)
  const backColour = hexToAssColor(s.backgroundColor, s.backgroundOpacity)
  const bold = s.bold ? -1 : 0
  const italic = s.italic ? -1 : 0
  // 背景ありなら不透明ボックス(3)、なければ縁取り(1)
  const borderStyle = s.backgroundEnabled ? 3 : 1
  const outline = s.backgroundEnabled
    ? Math.max(4, Math.round(height * 0.006)) // ボックスの余白
    : s.outline
    ? Math.max(2, Math.round(height * 0.004)) // 縁取りの太さ
    : 0
  const shadow = s.backgroundEnabled
    ? 0
    : s.shadow
    ? Math.max(2, Math.round(height * 0.004))
    : 0
  const alignment = positionToAlignment(s.position)
  const marginV = Math.round(height * 0.06)
  const marginLR = Math.round(width * 0.04)

  const styleLine = (name: string) =>
    `Style: ${name},${fontName},${fontSize},${primary},&H000000FF,${outlineColour},${backColour},${bold},${italic},0,0,100,100,0,0,${borderStyle},${outline},${shadow},${alignment},${marginLR},${marginLR},${marginV},1`

  return { fontName, fontSize, outline, borderStyle, outlineColorHex, styleLine }
}

/**
 * SubtitleSegment[] を スタイル付き ASS 文字列に変換。
 * PlayResX/Y を動画の実寸にすることで、フォントサイズ(%)が出力解像度に正しく追従する。
 * 個別スタイル(styleOverride)を持つセグメントには専用の Style 行を生成する
 * （背景・位置・縁取りなどインラインタグで表現できない上書きも書き出しに反映するため）。
 */
export function segmentsToAss(
  segments: SubtitleSegment[],
  style: SubtitleStyle,
  width: number,
  height: number
): string {
  const base = computeAssStyleParams(style, width, height)
  const styleLines: string[] = [base.styleLine('Default')]

  const events = segments
    .map((seg, idx) => {
      // セグメント個別スタイルをグローバルとマージ。上書きがあれば専用 Style を発行
      const eff = mergeStyle(style, seg.styleOverride)
      const hasOverride = !!seg.styleOverride && Object.keys(seg.styleOverride).length > 0
      const params = hasOverride ? computeAssStyleParams(eff, width, height) : base
      const styleName = hasOverride ? `Seg${idx}` : 'Default'
      if (hasOverride) styleLines.push(params.styleLine(styleName))

      const segFontPx = params.fontSize
      const segMaxChars = computeEffectiveMaxChars(width, height, eff.fontSizePercent, eff.maxCharsPerLine)

      // インラインスタイルランがあれば run タグ込みで生成
      let textPart = seg.styleRuns?.length
        ? applyRunsToAss(seg.text, seg.styleRuns, segFontPx, eff.textColor, eff.bold, segMaxChars, {
            outlinePx: params.outline,
            boxMode: params.borderStyle === 3,
            outlineColorHex: params.outlineColorHex,
          })
        : escapeAssText(wrapText(seg.text, segMaxChars))

      // F-09 和欧混植: 英数字だけペアの欧文フォントに差し替え
      if (eff.latinFontEnabled) {
        textPart = applyLatinFontToAss(
          textPart,
          LATIN_FONT_PAIRS[eff.fontFamily].ass,
          fontFamilyToAss(eff.fontFamily)
        )
      }

      const start = secondsToAssTime(seg.startTime)
      const end = secondsToAssTime(seg.endTime)

      // 背景ボックスは行ごとに描かれ、行間で重なると二重ブレンドで濃くなる（ベタ塗りに見える）。
      // 背景ありのときは行を別イベントに分割し、重ならない行送りで座標指定して回避する。
      if (eff.backgroundEnabled) {
        const textLines = textPart.split('\\N')
        const n = textLines.length
        const lineHeight = Math.round(segFontPx * 1.35)
        const x = Math.round(width / 2)
        const segMarginV = Math.round(height * 0.06)
        return textLines
          .map((lineText, li) => {
            let y: number
            if (eff.position === 'top') {
              y = segMarginV + li * lineHeight
            } else if (eff.position === 'middle') {
              y = Math.round(height / 2 + (li - (n - 1) / 2) * lineHeight)
            } else {
              y = height - segMarginV - (n - 1 - li) * lineHeight
            }
            return `Dialogue: 0,${start},${end},${styleName},,0,0,0,,{\\an${positionToAlignment(eff.position)}\\pos(${x},${y})}${lineText}`
          })
          .join('\n')
      }

      return `Dialogue: 0,${start},${end},${styleName},,0,0,0,,${textPart}`
    })
    .join('\n')

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    ...styleLines,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n')

  return `${header}\n${events}\n`
}

/** Whisper の verbose_json レスポンス(segment単位)を SubtitleSegment[] に変換 */
export function whisperToSegments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whisperSegments: any[]
): SubtitleSegment[] {
  return whisperSegments.map((seg, i) => ({
    id: `seg-${i}`,
    startTime: seg.start,
    endTime: seg.end,
    text: seg.text.trim(),
  }))
}

/**
 * Whisper の単語タイムスタンプ(words)から、実際の発話に沿った字幕を生成する。
 * 無音(ポーズ)・文字数・長さで区切ることで、しゃべっている区間だけに字幕が出る。
 */
export function wordsToSegments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  words: any[],
  opts: { maxGap?: number; maxChars?: number; maxDuration?: number } = {}
): SubtitleSegment[] {
  const maxGap = opts.maxGap ?? 0.9 // この秒数以上の無音で区切る（短い息継ぎでは切らない）
  const maxChars = opts.maxChars ?? 32 // 1字幕の最大文字数（上限）
  const maxDuration = opts.maxDuration ?? 6 // 1字幕の最大秒数（上限）
  // 文末記号は意味の切れ目として区切る
  const sentenceEnd = /[。．！？!?]$/

  type Group = { startTime: number; endTime: number; text: string }
  const groups: Group[] = []
  let cur: Group | null = null

  for (const w of words) {
    const token: string = (w.word ?? '').toString()
    const start = Number(w.start)
    const end = Number(w.end)
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue

    // 無音・文字数・長さの上限を超えたら、まず現在の字幕を確定
    if (cur) {
      const gap = start - cur.endTime
      const tooLong = cur.text.length + token.length > maxChars
      const tooDur = end - cur.startTime > maxDuration
      if (gap > maxGap || tooLong || tooDur) {
        groups.push(cur)
        cur = null
      }
    }
    if (!cur) {
      cur = { startTime: start, endTime: end, text: token }
    } else {
      cur.text += token
      cur.endTime = end
    }
    // 意味の切れ目（文末）で区切る
    if (sentenceEnd.test(cur.text.trim())) {
      groups.push(cur)
      cur = null
    }
  }
  if (cur) groups.push(cur)

  return groups
    .map((g, i) => ({ id: `seg-${i}`, startTime: g.startTime, endTime: g.endTime, text: g.text.trim() }))
    .filter((s) => s.text.length > 0)
}
