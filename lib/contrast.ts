import { SubtitlePosition } from '@/types/subtitle'

/** WCAG 2.1 相対輝度 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** WCAG 2.1 コントラスト比（1〜21） */
export function contrastRatio(
  rgb1: { r: number; g: number; b: number },
  rgb2: { r: number; g: number; b: number }
): number {
  const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b)
  const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b)
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

export function hexToRgbValues(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

const SAMPLE_W = 64
const SAMPLE_H = 36

/**
 * F-03 テロップ表示帯の背景色サンプリング。
 * 現在の動画フレームを縮小描画し、字幕位置の帯の平均色を返す。
 */
export function sampleVideoBand(
  video: HTMLVideoElement,
  position: SubtitlePosition,
  canvas: HTMLCanvasElement
): { r: number; g: number; b: number } | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null
  canvas.width = SAMPLE_W
  canvas.height = SAMPLE_H
  const cx = canvas.getContext('2d', { willReadFrequently: true })
  if (!cx) return null
  try {
    cx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H)
    // 字幕が乗る帯（下: 65〜95%、中央: 35〜65%、上: 5〜35%）
    const [y0, y1] =
      position === 'top' ? [2, 13] : position === 'middle' ? [13, 24] : [23, 34]
    const data = cx.getImageData(0, y0, SAMPLE_W, y1 - y0).data
    let r = 0, g = 0, b = 0
    const n = data.length / 4
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]
    }
    return { r: r / n, g: g / n, b: b / n }
  } catch {
    // クロスオリジン等で読めない場合はチェックをスキップ
    return null
  }
}
