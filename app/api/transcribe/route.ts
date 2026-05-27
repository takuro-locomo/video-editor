import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import os from 'os'
import { transcribeAudio } from '@/lib/whisper'
import { getInputPath } from '@/lib/session'

export const runtime = 'nodejs'
export const maxDuration = 300 // Whisper は時間がかかる

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const inputPath = getInputPath(sessionId)

    // 音声ファイルの場合はそのまま、動画の場合は音声抽出
    let audioPath = inputPath
    const ext = path.extname(inputPath).toLowerCase()
    const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm']

    if (videoExts.includes(ext)) {
      // fluent-ffmpeg で音声抽出
      const { extractAudio } = await import('@/lib/ffmpeg-server')
      audioPath = path.join(os.tmpdir(), `audio-${sessionId}.m4a`)
      await extractAudio(inputPath, audioPath)
    }

    const result = await transcribeAudio(audioPath)

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Transcribe error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
