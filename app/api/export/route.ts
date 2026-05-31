import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getInputPath, getSessionDir } from '@/lib/session'
import { segmentsToAss } from '@/lib/subtitle-parser'
import {
  SubtitleSegment,
  SubtitleStyle,
  DEFAULT_SUBTITLE_STYLE,
  OutputSettings,
  DEFAULT_OUTPUT_SETTINGS,
} from '@/types/subtitle'

export const runtime = 'nodejs'
export const maxDuration = 600

export async function POST(req: NextRequest) {
  try {
    const {
      sessionId,
      segments,
      style,
      output,
    }: {
      sessionId: string
      segments: SubtitleSegment[]
      style?: SubtitleStyle
      output?: OutputSettings
    } = await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const inputPath = getInputPath(sessionId)
    const sessionDir = getSessionDir(sessionId)
    const assPath = path.join(sessionDir, 'subtitles.ass')
    const outputPath = path.join(os.tmpdir(), `output-${sessionId}.mp4`)

    // 動画の解像度を取得し、出力設定からターゲット解像度を計算
    const { burnSubtitles, getVideoDimensions, computeTargetDimensions } = await import(
      '@/lib/ffmpeg-server'
    )
    const { width, height } = await getVideoDimensions(inputPath)
    const outputSettings = output ?? DEFAULT_OUTPUT_SETTINGS
    const target = computeTargetDimensions(outputSettings.aspect, width, height)

    // 字幕は整形後のフレームに描画されるため、ASS の解像度もターゲットに合わせる
    const assDims = target ?? { width, height }
    const subtitleStyle = style ?? DEFAULT_SUBTITLE_STYLE
    fs.writeFileSync(
      assPath,
      segmentsToAss(segments, subtitleStyle, assDims.width, assDims.height),
      'utf-8'
    )

    // FFmpeg で字幕焼き込み（必要ならアスペクト比整形も）
    await burnSubtitles(
      inputPath,
      assPath,
      outputPath,
      target ? { ...target, fit: outputSettings.fit } : undefined
    )

    // ファイルをストリームで返す
    const fileBuffer = fs.readFileSync(outputPath)
    fs.unlinkSync(outputPath) // 一時ファイル削除

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="output.mp4"`,
      },
    })
  } catch (err) {
    console.error('Export error:', err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
