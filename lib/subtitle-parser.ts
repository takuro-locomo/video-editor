import { SubtitleSegment, SubtitleStyle } from '@/types/subtitle'
import { secondsToSrtTime } from './time-utils'
import { fontFamilyToAss, hexToAssColor, hexToAssBgr } from './subtitle-style'
import { parseRichText, wrapSpans, splitSpansByLine, stripRichTags, RichSpan } from './rich-text'

/** SubtitleSegment[] を SRT 文字列に変換 */
export function segmentsToSrt(segments: SubtitleSegment[]): string {
  return segments
    .map((seg, i) => {
      const start = secondsToSrtTime(seg.startTime)
      const end = secondsToSrtTime(seg.endTime)
      return `${i + 1}\n${start} --> ${end}\n${stripRichTags(seg.text)}\n`
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

/** 位置 → ASS の Alignment(numpad)。中央寄せ: top=8, middle=5, bottom=2 */
function positionToAlignment(position: SubtitleStyle['position']): number {
  return position === 'top' ? 8 : position === 'middle' ? 5 : 2
}

/** 1つのスタイル設定から ASS の Style 行を生成 */
function buildAssStyleLine(
  name: string,
  style: SubtitleStyle,
  width: number,
  height: number
): { line: string; fontSize: number; maxChars: number } {
  const fontName = fontFamilyToAss(style.fontFamily)
  const fontSize = Math.round((style.fontSizePercent / 100) * height)
  const primary = hexToAssColor(style.textColor, 1)
  // libass の BorderStyle=3（不透明ボックス）はボックスを OutlineColour で描画する
  const outlineColour = style.backgroundEnabled
    ? hexToAssColor(style.backgroundColor, style.backgroundOpacity)
    : hexToAssColor(style.outlineColor ?? '#000000', 1)
  const backColour = style.backgroundEnabled
    ? hexToAssColor(style.backgroundColor, style.backgroundOpacity)
    : hexToAssColor('#000000', 0.5) // 影の色（BorderStyle=1 のとき Shadow に使われる）
  const bold = style.bold ? -1 : 0
  const italic = style.italic ? -1 : 0
  // 背景ありなら不透明ボックス(3)、なければ縁取り(1)
  const borderStyle = style.backgroundEnabled ? 3 : 1
  const outline = style.backgroundEnabled
    ? Math.max(4, Math.round(height * 0.006)) // ボックスの余白
    : style.outline
    ? Math.max(2, Math.round(height * 0.004)) // 縁取りの太さ
    : 0
  const shadow = style.backgroundEnabled
    ? 0
    : style.shadow
    ? Math.max(2, Math.round(height * 0.004))
    : 0
  const alignment = positionToAlignment(style.position)
  const marginV = Math.round(height * 0.06)
  const marginLR = Math.round(width * 0.04)

  // 自動折り返し: フレーム幅とフォントサイズから1行に収まる文字数を求める。
  // libass は日本語(スペース無し)を折り返せないことがあるため、こちらで明示的に改行する。
  // 全角1文字 ≒ fontSize 幅とみなす。ユーザー指定があればその小さい方を採用。
  // 丸め前の値で計算する（プレビュー側と同じ比率ベースの式にして改行位置を一致させる）
  const usableWidth = width - width * 0.04 * 2
  const exactFontSize = (style.fontSizePercent / 100) * height
  const autoMaxChars = Math.max(1, Math.floor(usableWidth / exactFontSize))
  const maxChars =
    style.maxCharsPerLine > 0
      ? Math.min(style.maxCharsPerLine, autoMaxChars)
      : autoMaxChars

  const line = `Style: ${name},${fontName},${fontSize},${primary},&H000000FF,${outlineColour},${backColour},${bold},${italic},0,0,100,100,0,0,${borderStyle},${outline},${shadow},${alignment},${marginLR},${marginLR},${marginV},1`
  return { line, fontSize, maxChars }
}

/** 部分装飾スパン列を ASS のインラインタグ付きテキストに変換 */
function spansToAssText(spans: RichSpan[], baseFontSize: number): string {
  return spans
    .map((sp) => {
      const esc = escapeAssText(sp.text)
      const tags: string[] = []
      if (sp.color) tags.push(`\\c${hexToAssBgr(sp.color)}`)
      if (sp.sizePercent && sp.sizePercent !== 100) {
        tags.push(`\\fs${Math.max(1, Math.round((baseFontSize * sp.sizePercent) / 100))}`)
      }
      if (sp.bold) tags.push('\\b1')
      // {\r} でこの Dialogue のスタイルに戻す
      return tags.length ? `{${tags.join('')}}${esc}{\\r}` : esc
    })
    .join('')
}

/**
 * SubtitleSegment[] を スタイル付き ASS 文字列に変換。
 * PlayResX/Y を動画の実寸にすることで、フォントサイズ(%)が出力解像度に正しく追従する。
 * 字幕ごとの styleOverride は専用の Style 行として出力し、
 * テキスト内の部分装飾（<c=> <s=> <b>）はインラインタグに変換する。
 */
export function segmentsToAss(
  segments: SubtitleSegment[],
  style: SubtitleStyle,
  width: number,
  height: number
): string {
  const styleLines: string[] = []
  const base = buildAssStyleLine('Default', style, width, height)
  styleLines.push(base.line)

  const events: string[] = []
  segments.forEach((seg, i) => {
    let styleName = 'Default'
    let fontSize = base.fontSize
    let maxChars = base.maxChars
    const merged = { ...style, ...seg.styleOverride }
    if (seg.styleOverride && Object.keys(seg.styleOverride).length > 0) {
      styleName = `Seg${i}`
      const own = buildAssStyleLine(styleName, merged, width, height)
      styleLines.push(own.line)
      fontSize = own.fontSize
      maxChars = own.maxChars
    }
    const spans = wrapSpans(parseRichText(seg.text), maxChars)
    const start = secondsToAssTime(seg.startTime)
    const end = secondsToAssTime(seg.endTime)

    if (merged.backgroundEnabled) {
      // 背景ボックスは行ごとに描かれ、行間で重なると二重ブレンドで濃くなる。
      // 行を別イベントに分割し、重ならない行送りで座標指定して回避する。
      const lines = splitSpansByLine(spans)
      const n = lines.length
      const lineHeight = Math.round(fontSize * 1.35)
      const x = Math.round(width / 2)
      const marginV = Math.round(height * 0.06)
      lines.forEach((lineSpans, li) => {
        let y: number
        if (merged.position === 'top') {
          y = marginV + li * lineHeight
        } else if (merged.position === 'middle') {
          y = Math.round(height / 2 + (li - (n - 1) / 2) * lineHeight)
        } else {
          y = height - marginV - (n - 1 - li) * lineHeight
        }
        const text = spansToAssText(lineSpans, fontSize)
        events.push(
          `Dialogue: 0,${start},${end},${styleName},,0,0,0,,{\\pos(${x},${y})}${text}`
        )
      })
    } else {
      const text = spansToAssText(spans, fontSize)
      events.push(`Dialogue: 0,${start},${end},${styleName},,0,0,0,,${text}`)
    }
  })

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

  return `${header}\n${events.join('\n')}\n`
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
