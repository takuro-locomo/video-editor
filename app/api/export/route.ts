import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getInputPath, getSessionDir } from '@/lib/session'
import { segmentsToSrt } from '@/lib/subtitle-parser'
import { SubtitleSegment } from '@/types/subtitle'

export const runtime = 'nodejs'
export const maxDuration = 600

export async function POST(req: NextRequest) {
  try {
    const { sessionId, segments }: { sessionId: string; segments: SubtitleSegment[] } =
      await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const inputPath = getInputPath(sessionId)
    const sessionDir = getSessionDir(sessionId)
    const srtPath = path.join(sessionDir, 'subtitles.srt')
    const outputPath = path.join(os.tmpdir(), `output-${sessionId}.mp4`)

    // SRT ファイルを書き出し
    fs.writeFileSync(srtPath, segmentsToSrt(segments), 'utf-8')

    // FFmpeg で字幕焼き込み
    const { burnSubtitles } = await import('@/lib/ffmpeg-server')
    await burnSubtitles(inputPath, srtPath, outputPath)

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
