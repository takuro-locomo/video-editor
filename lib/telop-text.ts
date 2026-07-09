import { StyleRun, SubtitleSegment } from '@/types/subtitle'
import { TELOP_RULES, EMPHASIS_KEYWORDS, FILLER_WORDS, FILLER_WORDS_BOUNDARY } from './telop-rules'

/**
 * F-11 句読点→スペース変換（字幕の業界慣習）。
 * 「、」→ 半角スペース、文中の「。」→ スペース、文末の「。」→ 削除。
 */
export function convertPunctuation(text: string): string {
  return text
    .replace(/、/g, ' ')
    .replace(/。(?=.)/g, ' ')
    .replace(/。/g, '')
    .replace(/ +$/gm, '')
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 要約支援（仕様書5章）: フィラー（言いよどみ）除去。
 * 「えっと」「あのー」等を削除する。発話をそのまま全文テロップ化させないための第一歩。
 * 「えー」「うーん」単独は相槌等で意味を持つことがあるため、直後が句読点・空白・文末のときだけ消す。
 */
export function removeFillers(text: string): string {
  const always = new RegExp(`(?:${FILLER_WORDS.map(escapeRe).join('|')})[、。\\s]*`, 'g')
  const boundary = new RegExp(
    `(?:^|(?<=[、。\\s]))(?:${FILLER_WORDS_BOUNDARY.map(escapeRe).join('|')})(?:[、。\\s]+|$)`,
    'g'
  )
  return text
    .replace(always, '')
    .replace(boundary, '')
    .replace(/ {2,}/g, ' ')
    .trim()
}

/** 既存ランと重ならない範囲だけ残す */
function withoutOverlap(candidates: StyleRun[], existing: StyleRun[]): StyleRun[] {
  return candidates.filter(
    (c) => !existing.some((e) => !(e.to <= c.from || e.from >= c.to))
  )
}

/**
 * F-07 キーワード自動強調の候補検出。
 * 形態素解析なしのヒューリスティック: 強調辞書 > 数字+単位 > カタカナ語 の優先順で、
 * 1テロップにつき最大2箇所（ガードレール）。
 */
export function detectEmphasisRuns(
  text: string,
  emphasisColor: string,
  existing: StyleRun[] = []
): StyleRun[] {
  type Cand = { from: number; to: number; priority: number }
  const cands: Cand[] = []

  // 優先1: 強調辞書の語
  for (const kw of EMPHASIS_KEYWORDS) {
    let idx = text.indexOf(kw)
    while (idx !== -1) {
      cands.push({ from: idx, to: idx + kw.length, priority: 0 })
      idx = text.indexOf(kw, idx + kw.length)
    }
  }
  // 優先2: 数字（+単位）
  const numRe = /[0-9０-９]+(?:[.,．，][0-9０-９]+)?(?:円|万円|%|％|kg|g|km|cm|m|年|ヶ月|か月|日|時間|分|秒|人|回|倍|個|件|割|歳|点)?/g
  for (const m of text.matchAll(numRe)) {
    if (m[0].length >= 2 || /[0-9０-９]/.test(m[0])) {
      cands.push({ from: m.index!, to: m.index! + m[0].length, priority: 1 })
    }
  }
  // 優先3: カタカナ語（3文字以上）
  for (const m of text.matchAll(/[ァ-ヴー]{3,}/g)) {
    cands.push({ from: m.index!, to: m.index! + m[0].length, priority: 2 })
  }

  // 優先度順に、互いに重ならないよう最大数まで採用
  cands.sort((a, b) => a.priority - b.priority || a.from - b.from)
  const picked: Cand[] = []
  for (const c of cands) {
    if (picked.length >= TELOP_RULES.emphasisMaxPerSegment) break
    if (picked.some((p) => !(p.to <= c.from || p.from >= c.to))) continue
    picked.push(c)
  }

  const runs: StyleRun[] = picked.map((c) => ({
    from: c.from,
    to: c.to,
    color: emphasisColor,
    sizeMultiplier: TELOP_RULES.emphasisSizeMultiplier,
    bold: true,
  }))
  return withoutOverlap(runs, existing).sort((a, b) => a.from - b.from)
}

/**
 * F-08 助詞・単位・敬称の自動縮小（テレビ品質の仕上がり）。
 * 漢字・カタカナ・英数字の直後に来る助詞、数字直後の単位、敬称を検出して縮小ランを返す。
 */
export function detectParticleRuns(
  text: string,
  existing: StyleRun[] = []
): StyleRun[] {
  const runs: StyleRun[] = []
  const push = (from: number, to: number) =>
    runs.push({ from, to, sizeMultiplier: TELOP_RULES.particleShrinkRatio })

  // 助詞: 漢字/カタカナ/英数字の直後で、後ろがひらがなでない位置
  const particleRe = /(?<=[一-龠々ヵヶァ-ヴーA-Za-z0-9０-９])(は|が|を|に|へ|と|で|も|の)(?![ぁ-ん])/g
  for (const m of text.matchAll(particleRe)) push(m.index!, m.index! + m[1].length)

  // 単位: 数字の直後
  const unitRe = /(?<=[0-9０-９])(円|万円|%|％|kg|g|km|cm|mm|m|年|ヶ月|か月|日|時間|分|秒|人|回|倍|個|件|割|歳|点)/g
  for (const m of text.matchAll(unitRe)) push(m.index!, m.index! + m[1].length)

  // 敬称・肩書: 漢字/カタカナの直後
  const honorificRe = /(?<=[一-龠々ァ-ヴー])(さん|様|氏|くん|ちゃん|社長|部長|先生|選手|監督)(?![ぁ-んァ-ヴ一-龠])/g
  for (const m of text.matchAll(honorificRe)) push(m.index!, m.index! + m[1].length)

  return withoutOverlap(runs, existing).sort((a, b) => a.from - b.from)
}

/**
 * F-10 タイミング自動調整。
 * IN点: 音声より leadInFrames 先行（R-18）
 * OUT点: 発話終了から holdAfterSec 後（R-19）。ただし次の字幕・動画末尾は越えない。
 */
export function autoAdjustTiming(
  segments: SubtitleSegment[],
  duration: number
): SubtitleSegment[] {
  const lead = TELOP_RULES.leadInFrames / TELOP_RULES.assumedFps
  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime)
  const result: SubtitleSegment[] = []

  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i]
    const prevEnd = i > 0 ? result[i - 1].endTime : 0
    // 次の字幕の（先行後の）開始位置を越えない
    const nextStart = i < sorted.length - 1 ? sorted[i + 1].startTime - lead : Infinity

    let start = Math.max(seg.startTime - lead, prevEnd + 0.01, 0)
    let end = Math.min(
      seg.endTime + TELOP_RULES.holdAfterSec,
      nextStart - 0.01,
      duration > 0 ? duration : Infinity
    )
    // 調整の結果つぶれてしまう場合は元の区間を維持
    if (end <= start) {
      start = seg.startTime
      end = seg.endTime
    }
    result.push({ ...seg, startTime: round2(start), endTime: round2(end) })
  }
  return result
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
