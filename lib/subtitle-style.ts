import { SubtitleFontFamily } from '@/types/subtitle'

/** プレビュー(CSS)用のフォントスタック */
export function fontFamilyToCss(family: SubtitleFontFamily): string {
  switch (family) {
    case 'mincho':
      return '"Yu Mincho", "YuMincho", "MS Mincho", serif'
    case 'notosans':
      return '"Noto Sans JP", "Yu Gothic", sans-serif'
    case 'gothic':
    default:
      return '"Yu Gothic", "YuGothic", "Meiryo", sans-serif'
  }
}

/** 書き出し(libass/ASS)用のフォント名 */
export function fontFamilyToAss(family: SubtitleFontFamily): string {
  switch (family) {
    case 'mincho':
      return 'MS Mincho'
    case 'notosans':
      return 'Noto Sans JP'
    case 'gothic':
    default:
      return 'Meiryo'
  }
}

/**
 * 1行の最大文字数で自動改行する。maxChars<=0 なら何もしない。
 * 既存の改行は維持し、各行をコードポイント単位で折り返す（日本語向け）。
 */
export function wrapText(text: string, maxChars: number): string {
  if (!maxChars || maxChars <= 0) return text
  return text
    .split(/\r?\n/)
    .map((line) => {
      const chars = Array.from(line)
      if (chars.length <= maxChars) return line
      const out: string[] = []
      for (let i = 0; i < chars.length; i += maxChars) {
        out.push(chars.slice(i, i + maxChars).join(''))
      }
      return out.join('\n')
    })
    .join('\n')
}

/** #RRGGBB → rgba(r,g,b,a) 文字列（CSS用） */
export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

/**
 * #RRGGBB → ASS の色表記 &HAABBGGRR
 * ASS は BGR 順 + アルファ(00=不透明, FF=透明)
 */
export function hexToAssColor(hex: string, alpha = 1): string {
  const { r, g, b } = hexToRgb(hex)
  const aa = Math.round((1 - alpha) * 255) // ASS: 00=不透明
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase()
  return `&H${toHex(aa)}${toHex(b)}${toHex(g)}${toHex(r)}`
}
