import ffmpeg from 'fluent-ffmpeg'
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
  format?: { width: number; height: number; fit: OutputFit },
  trim?: { start: number; end: number }
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
    const command = ffmpeg(inputPath)
    // トリミング: 開始位置までシークし、区間長だけ出力（字幕側の時刻は事前にシフト済み）
    if (trim && trim.end > trim.start) {
      command.seekInput(trim.start).duration(trim.end - trim.start)
    }
    command
      .videoFilters(filters)
      .outputOptions('-c:a copy')
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath)
  })
}

/** 動画の解像度・音声有無・長さを取得 */
function getVideoInfo(
  inputPath: string
): Promise<{ width: number; height: number; hasAudio: boolean; duration: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) return reject(err)
      const v = data.streams.find((s) => s.codec_type === 'video')
      const a = data.streams.find((s) => s.codec_type === 'audio')
      if (!v || !v.width || !v.height) {
        return reject(new Error('動画情報を取得できませんでした'))
      }
      resolve({
        width: v.width,
        height: v.height,
        hasAudio: !!a,
        duration: Number(data.format.duration) || 0,
      })
    })
  })
}

/**
 * 複数動画を1本に結合。
 * 解像度・アスペクト比・音声有無が異なっても結合できるよう、
 * 各クリップを先頭動画の解像度に正規化(scale+pad)し、30fps・共通音声形式に揃えて連結する。
 */
export async function mergeVideos(inputPaths: string[], outputPath: string): Promise<void> {
  const infos = await Promise.all(inputPaths.map(getVideoInfo))

  // ターゲット解像度: 先頭動画基準（H.264 のため偶数化）
  let W = infos[0].width
  let H = infos[0].height
  W -= W % 2
  H -= H % 2

  // どれか1つでも音声があれば、無音クリップには無音トラックを足して音声付きで結合
  const withAudio = infos.some((i) => i.hasAudio)

  const command = ffmpeg()
  inputPaths.forEach((p) => command.input(p))

  // 無音クリップ用の無音ソース（lavfi anullsrc）を必要分だけ追加
  const silentAudioInput: Record<number, number> = {}
  let lavfiCount = 0
  if (withAudio) {
    infos.forEach((info, i) => {
      if (!info.hasAudio) {
        silentAudioInput[i] = inputPaths.length + lavfiCount
        lavfiCount += 1
        command
          .input('anullsrc=channel_layout=stereo:sample_rate=44100')
          .inputFormat('lavfi')
      }
    })
  }

  const filters: string[] = []
  const concatLabels: string[] = []
  infos.forEach((info, i) => {
    filters.push(
      `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
        `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p[v${i}]`
    )
    if (withAudio) {
      const aLabel = info.hasAudio ? `${i}:a` : `${silentAudioInput[i]}:a`
      const trim = info.hasAudio ? '' : `atrim=duration=${info.duration.toFixed(3)},`
      filters.push(
        `[${aLabel}]${trim}aformat=sample_rates=44100:channel_layouts=stereo,` +
          `asetpts=PTS-STARTPTS[a${i}]`
      )
      concatLabels.push(`[v${i}][a${i}]`)
    } else {
      concatLabels.push(`[v${i}]`)
    }
  })
  filters.push(
    `${concatLabels.join('')}concat=n=${infos.length}:v=1:a=${withAudio ? 1 : 0}` +
      `[outv]${withAudio ? '[outa]' : ''}`
  )

  return new Promise((resolve, reject) => {
    command.complexFilter(filters, withAudio ? ['outv', 'outa'] : ['outv'])
    command.outputOptions([
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
    ])
    if (withAudio) {
      command.outputOptions(['-c:a', 'aac', '-b:a', '192k'])
    }
    command
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath)
  })
}
