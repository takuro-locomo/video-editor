import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getInputPath, getSessionDir } from '@/lib/session'
import { segmentsToAss } from '@/lib/subtitle-parser'
import { SubtitleSegment, SubtitleStyle, DEFAULT_SUBTITLE_STYLE } from '@/types/subtitle'

export const runtime = 'nodejs'
export const maxDuration = 600

export async function POST(req: NextRequest) {
  try {
    const {
      sessionId,
      segments,
      style,
    }: { sessionId: string; segments: SubtitleSegment[]; style?: SubtitleStyle } =
      await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const inputPath = getInputPath(sessionId)
    const sessionDir = getSessionDir(sessionId)
    const assPath = path.join(sessionDir, 'subtitles.ass')
    const outputPath = path.join(os.tmpdir(), `output-${sessionId}.mp4`)

    // 動画の解像度を取得し、スタイル付き ASS 字幕を書き出し
    const { burnSubtitles, getVideoDimensions } = await import('@/lib/ffmpeg-server')
    const { width, height } = await getVideoDimensions(inputPath)
    const subtitleStyle = style ?? DEFAULT_SUBTITLE_STYLE
    fs.writeFileSync(assPath, segmentsToAss(segments, subtitleStyle, width, height), 'utf-8')

    // FFmpeg で字幕焼き込み
    await burnSubtitles(inputPath, assPath, outputPath)

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
