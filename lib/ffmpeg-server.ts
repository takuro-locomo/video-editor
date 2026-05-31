import ffmpeg from 'fluent-ffmpeg'
import os from 'os'

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

/** 動画に字幕ファイル(SRT/ASS)を焼き込んで MP4 出力 */
export function burnSubtitles(
  inputPath: string,
  subtitlePath: string,
  outputPath: string
): Promise<void> {
  // Windows パスのバックスラッシュをエスケープ
  const escapedPath = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:')

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`subtitles='${escapedPath}'`)
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
