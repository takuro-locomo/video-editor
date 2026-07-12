import { StyleRun } from '@/types/subtitle'

/** StyleRun の装飾プロパティ部分（範囲を除く） */
export type RunProps = Omit<StyleRun, 'from' | 'to'>

const PROP_KEYS = ['sizeMultiplier', 'color', 'bold', 'backgroundColor'] as const

function hasAnyProp(p: RunProps | undefined): p is RunProps {
  return !!p && PROP_KEYS.some((k) => p[k] !== undefined)
}

function sameProps(a: RunProps | undefined, b: RunProps | undefined): boolean {
  return PROP_KEYS.every((k) => a?.[k] === b?.[k])
}

/**
 * 選択範囲 [from, to) に装飾パッチを合成適用する。
 * 既存の装飾と重なる部分は「既存＋パッチ」をマージ（例: 大きく→色 で両方が効く）。
 * patch=null なら範囲内の装飾をすべて解除する。
 * 文字ごとの装飾マップに展開してからランレングス圧縮し直すので、
 * 分割・結合・隣接マージが常に正しく行われる。
 */
export function applyRunPatch(
  textLength: number,
  runs: StyleRun[],
  from: number,
  to: number,
  patch: RunProps | null
): StyleRun[] {
  const lo = Math.max(0, Math.min(from, textLength))
  const hi = Math.max(lo, Math.min(to, textLength))

  // 文字ごとの装飾に展開（後から来たランが優先＝現行の適用順を踏襲）
  const props: (RunProps | undefined)[] = new Array(textLength).fill(undefined)
  for (const r of runs) {
    const { from: _f, to: _t, ...rProps } = r
    for (let i = Math.max(0, r.from); i < Math.min(textLength, r.to); i++) {
      props[i] = { ...props[i], ...rProps }
    }
  }

  // パッチ適用
  for (let i = lo; i < hi; i++) {
    if (patch === null) {
      props[i] = undefined
    } else {
      props[i] = { ...props[i], ...patch }
    }
  }

  // ランレングス圧縮
  const out: StyleRun[] = []
  let i = 0
  while (i < textLength) {
    if (!hasAnyProp(props[i])) { i++; continue }
    let j = i + 1
    while (j < textLength && sameProps(props[i], props[j])) j++
    const p = props[i]!
    const run: StyleRun = { from: i, to: j }
    if (p.sizeMultiplier !== undefined) run.sizeMultiplier = p.sizeMultiplier
    if (p.color !== undefined) run.color = p.color
    if (p.bold !== undefined) run.bold = p.bold
    if (p.backgroundColor !== undefined) run.backgroundColor = p.backgroundColor
    out.push(run)
    i = j
  }
  return out
}
