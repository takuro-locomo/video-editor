import ffmpeg from 'fluent-ffmpeg'

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

/** 動画に SRT 字幕を焼き込んで MP4 出力 */
export function burnSubtitles(
  inputPath: string,
  srtPath: string,
  outputPath: string
): Promise<void> {
  // Windows パスのバックスラッシュをエスケープ
  const escapedSrt = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:')

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`subtitles='${escapedSrt}'`)
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
      .mergeToFile(outputPath, require('os').tmpdir())
  })
}
