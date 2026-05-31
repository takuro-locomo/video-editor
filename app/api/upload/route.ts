import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { ensureSessionDir } from '@/lib/session'

export const runtime = 'nodejs'
export const maxDuration = 60

// Next.js 15 のデフォルト body size limit を無効化
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('video') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 })
    }

    // ファイルサイズ制限: 2GB
    if (file.size > 2 * 1024 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 2GB)' }, { status: 400 })
    }

    const sessionId = uuidv4()
    const sessionDir = ensureSessionDir(sessionId)

    const ext = path.extname(file.name) || '.mp4'
    const inputPath = path.join(sessionDir, `input${ext}`)

    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(inputPath, buffer)

    // 動画の基本情報を取得（duration は後で ffprobe で取得）
    return NextResponse.json({
      sessionId,
      filename: file.name,
      size: file.size,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
