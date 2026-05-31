import { SubtitleSegment, SubtitleStyle } from '@/types/subtitle'
import { secondsToSrtTime } from './time-utils'
import { fontFamilyToAss, hexToAssColor, wrapText } from './subtitle-style'

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

/** 位置 → ASS の Alignment(numpad)。中央寄せ: top=8, middle=5, bottom=2 */
function positionToAlignment(position: SubtitleStyle['position']): number {
  return position === 'top' ? 8 : position === 'middle' ? 5 : 2
}

/**
 * SubtitleSegment[] を スタイル付き ASS 文字列に変換。
 * PlayResX/Y を動画の実寸にすることで、フォントサイズ(%)が出力解像度に正しく追従する。
 */
export function segmentsToAss(
  segments: SubtitleSegment[],
  style: SubtitleStyle,
  width: number,
  height: number
): string {
  const fontName = fontFamilyToAss(style.fontFamily)
  const fontSize = Math.round((style.fontSizePercent / 100) * height)
  const primary = hexToAssColor(style.textColor, 1)
  const outlineColour = '&H00000000' // 黒フチ
  const backColour = hexToAssColor(style.backgroundColor, style.backgroundOpacity)
  const bold = style.bold ? -1 : 0
  // 背景ありなら不透明ボックス(3)、なければ縁取り(1)
  const borderStyle = style.backgroundEnabled ? 3 : 1
  const outline = style.backgroundEnabled
    ? Math.max(4, Math.round(height * 0.006)) // ボックスの余白
    : style.outline
    ? Math.max(2, Math.round(height * 0.004)) // 縁取りの太さ
    : 0
  const shadow = style.backgroundEnabled || !style.outline ? 0 : 1
  const alignment = positionToAlignment(style.position)
  const marginV = Math.round(height * 0.06)
  const marginLR = Math.round(width * 0.04)

  // 自動折り返し: フレーム幅とフォントサイズから1行に収まる文字数を求める。
  // libass は日本語(スペース無し)を折り返せないことがあるため、こちらで明示的に改行する。
  // 全角1文字 ≒ fontSize 幅とみなす。ユーザー指定があればその小さい方を採用。
  const usableWidth = width - marginLR * 2
  const autoMaxChars = Math.max(1, Math.floor(usableWidth / fontSize))
  const effectiveMaxChars =
    style.maxCharsPerLine > 0
      ? Math.min(style.maxCharsPerLine, autoMaxChars)
      : autoMaxChars

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
    `Style: Default,${fontName},${fontSize},${primary},&H000000FF,${outlineColour},${backColour},${bold},0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},${alignment},${marginLR},${marginLR},${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n')

  const events = segments
    .map(
      (seg) =>
        `Dialogue: 0,${secondsToAssTime(seg.startTime)},${secondsToAssTime(seg.endTime)},Default,,0,0,0,,${escapeAssText(wrapText(seg.text, effectiveMaxChars))}`
    )
    .join('\n')

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
  const maxGap = opts.maxGap ?? 0.6 // この秒数以上の無音で区切る
  const maxChars = opts.maxChars ?? 18 // 1字幕の目安文字数
  const maxDuration = opts.maxDuration ?? 4 // 1字幕の最大秒数

  type Group = { startTime: number; endTime: number; text: string }
  const groups: Group[] = []
  let cur: Group | null = null

  for (const w of words) {
    const token: string = (w.word ?? '').toString()
    const start = Number(w.start)
    const end = Number(w.end)
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue

    if (!cur) {
      cur = { startTime: start, endTime: end, text: token }
      continue
    }
    const gap = start - cur.endTime
    const tooLong = cur.text.length + token.length > maxChars
    const tooDur = end - cur.startTime > maxDuration
    if (gap > maxGap || tooLong || tooDur) {
      groups.push(cur)
      cur = { startTime: start, endTime: end, text: token }
    } else {
      cur.text += token
      cur.endTime = end
    }
  }
  if (cur) groups.push(cur)

  return groups
    .map((g, i) => ({ id: `seg-${i}`, startTime: g.startTime, endTime: g.endTime, text: g.text.trim() }))
    .filter((s) => s.text.length > 0)
}
