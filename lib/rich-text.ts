/**
 * 字幕テキストの部分装飾（インライン記法）。
 *   <c=#FF0000>赤い文字</c>  … 色
 *   <s=150>大きい文字</s>    … サイズ（基準サイズに対する%）
 *   <b>太字</b>              … 太字
 * ネスト可。認識できないタグはそのまま文字として扱う。
 */

export interface RichSpan {
  text: string
  color?: string       // #RRGGBB
  sizePercent?: number // 100=基準サイズ
  bold?: boolean
}

const TOKEN_RE = /<c=(#[0-9a-fA-F]{6})>|<s=(\d{2,3})>|<b>|<\/c>|<\/s>|<\/b>/g

/** インライン記法をスタイル付きスパンの配列に分解する */
export function parseRichText(text: string): RichSpan[] {
  const spans: RichSpan[] = []
  const colorStack: string[] = []
  const sizeStack: number[] = []
  let boldDepth = 0
  let last = 0

  const push = (t: string) => {
    if (!t) return
    spans.push({
      text: t,
      color: colorStack[colorStack.length - 1],
      sizePercent: sizeStack[sizeStack.length - 1],
      bold: boldDepth > 0 || undefined,
    })
  }

  TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(text)) !== null) {
    push(text.slice(last, m.index))
    last = m.index + m[0].length
    const tok = m[0]
    if (m[1]) colorStack.push(m[1].toUpperCase())
    else if (m[2]) sizeStack.push(Number(m[2]))
    else if (tok === '<b>') boldDepth += 1
    else if (tok === '</c>') colorStack.pop()
    else if (tok === '</s>') sizeStack.pop()
    else if (tok === '</b>') boldDepth = Math.max(0, boldDepth - 1)
  }
  push(text.slice(last))
  return spans
}

/** 装飾タグを取り除いた素のテキストを返す */
export function stripRichTags(text: string): string {
  return text.replace(TOKEN_RE, '')
}

/** 装飾タグを含むかどうか */
export function hasRichTags(text: string): boolean {
  TOKEN_RE.lastIndex = 0
  return TOKEN_RE.test(text)
}

/** スパン列を改行(\n)で行ごとのスパン配列に分割する（空行は除く） */
export function splitSpansByLine(spans: RichSpan[]): RichSpan[][] {
  const lines: RichSpan[][] = [[]]
  for (const sp of spans) {
    const parts = sp.text.split('\n')
    parts.forEach((part, i) => {
      if (i > 0) lines.push([])
      if (part) lines[lines.length - 1].push({ ...sp, text: part })
    })
  }
  return lines.filter((line) => line.length > 0)
}

/**
 * 表示文字数ベースでスパン列に改行(\n)を挿入する。
 * 既存の改行はそのまま行の区切りとして扱う。maxChars<=0 なら何もしない。
 * タグ文字はカウントしないため、装飾があっても改行位置がずれない。
 */
export function wrapSpans(spans: RichSpan[], maxChars: number): RichSpan[] {
  if (!maxChars || maxChars <= 0) return spans
  const out: RichSpan[] = []
  let count = 0
  for (const sp of spans) {
    let buf = ''
    for (const ch of Array.from(sp.text)) {
      if (ch === '\n') {
        buf += ch
        count = 0
        continue
      }
      if (count >= maxChars) {
        buf += '\n'
        count = 0
      }
      buf += ch
      count += 1
    }
    out.push({ ...sp, text: buf })
  }
  return out
}
