import ffmpeg from 'fluent-ffmpeg'
import os from 'os'
import { OutputAspect, OutputFit } from '@/types/subtitle'

/** アスペクト比と元動画サイズから出力解像度を決定（original は null） */
export function computeTargetDimensions(
  aspect: OutputAspect,
  srcWidth: number,
  srcHeight: number
): { width: number; height: number } | null {
  if (aspect === 'original') return null
  // 元動画の長辺を基準に、極端な拡大を避けつつ目標比率の解像度を作る
  const longEdge = Math.max(srcWidth, srcHeight)
  const base = Math.min(Math.max(longEdge, 720), 1920) // 720〜1920 に収める
  const ratios: Record<Exclude<OutputAspect, 'original'>, [number, number]> = {
    '9:16': [9, 16],
    '1:1': [1, 1],
    '16:9': [16, 9],
  }
  const [rw, rh] = ratios[aspect]
  let width: number
  let height: number
  if (rw >= rh) {
    width = base
    height = Math.round((base * rh) / rw)
  } else {
    height = base
    width = Math.round((base * rw) / rh)
  }
  // H.264 のため偶数に丸める
  return { width: width - (width % 2), height: height - (height % 2) }
}

/** 動画の解像度(幅・高さ)を取得 */
export function getVideoDimensions(
  inputPath: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) return reject(err)
      const stream = data.streams.find((s) => s.codec_type === 'video')
      if (!stream || !stream.width || !stream.height) {
        return reject(new Error('動画の解像度を取得できませんでした'))
      }
      resolve({ width: stream.width, height: stream.height })
    })
  })
}

/** 動画から音声のみを MP3 で抽出 */
export function extractAudio(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec('aac')
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath)
  })
}

/**
 * 動画に字幕ファイル(SRT/ASS)を焼き込んで MP4 出力。
 * format を渡すと、先に指定アスペクト比へ整形(pad/crop)してから字幕を焼き込む。
 * 字幕は整形後のフレームに対して描画されるため画面内に収まる。
 */
export function burnSubtitles(
  inputPath: string,
  subtitlePath: string,
  outputPath: string,
  format?: { width: number; height: number; fit: OutputFit }
): Promise<void> {
  // Windows パスのバックスラッシュをエスケープ
  const escapedPath = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:')

  const filters: string[] = []
  if (format) {
    const { width: w, height: h, fit } = format
    if (fit === 'pad') {
      // 全体を表示し、足りない部分を黒帯で埋める
      filters.push(`scale=${w}:${h}:force_original_aspect_ratio=decrease`)
      filters.push(`pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`)
    } else {
      // 画面いっぱいに拡大し、はみ出す部分を切り抜く
      filters.push(`scale=${w}:${h}:force_original_aspect_ratio=increase`)
      filters.push(`crop=${w}:${h}`)
    }
  }
  filters.push(`subtitles='${escapedPath}'`)

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(filters)
      .outputOptions('-c:a copy')
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath)
  })
}

/** 複数動画を結合 */
export function mergeVideos(inputPaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg()
    inputPaths.forEach(p => command.input(p))
    command
      .on('end', () => resolve())
      .on('error', reject)
      .mergeToFile(outputPath, os.tmpdir())
  })
}
