import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { getSessionDir } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// プレビュー動画を Range 対応で配信する（シークに必要）
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    if (!/^[0-9a-f-]+$/i.test(sessionId)) {
      return NextResponse.json({ error: 'invalid sessionId' }, { status: 400 })
    }
    const dir = getSessionDir(sessionId)

    // ブラウザ再生用に整えた preview.mp4 を優先、なければ元ファイル
    let filePath = path.join(dir, 'preview.mp4')
    if (!fs.existsSync(filePath)) {
      const input = fs.readdirSync(dir).find((f) => f.startsWith('input.'))
      if (!input) return NextResponse.json({ error: 'not found' }, { status: 404 })
      filePath = path.join(dir, input)
    }

    const size = fs.statSync(filePath).size
    const range = req.headers.get('range')

    if (range) {
      const m = /bytes=(\d+)-(\d*)/.exec(range)
      const start = m ? Number(m[1]) : 0
      const end = m && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
      const stream = fs.createReadStream(filePath, { start, end })
      return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(end - start + 1),
          'Content-Type': 'video/mp4',
        },
      })
    }

    const stream = fs.createReadStream(filePath)
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Length': String(size),
        'Content-Type': 'video/mp4',
      },
    })
  } catch (err) {
    console.error('Video serve error:', err)
    return NextResponse.json({ error: 'serve failed' }, { status: 500 })
  }
}
