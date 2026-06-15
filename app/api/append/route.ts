import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getSessionDir, getInputPath } from '@/lib/session'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const sessionId = formData.get('sessionId') as string | null
    const file = formData.get('video') as File | null

    if (!sessionId || !file) {
      return NextResponse.json({ error: 'sessionId と video が必要です' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024 * 1024) {
      return NextResponse.json({ error: 'ファイルが大きすぎます（最大2GB）' }, { status: 400 })
    }

    const sessionDir = getSessionDir(sessionId)
    if (!fs.existsSync(sessionDir)) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
    }

    const existingPath = getInputPath(sessionId)
    const ext = path.extname(file.name) || '.mp4'
    const appendSrcPath = path.join(sessionDir, `append-src${ext}`)
    const mergedPath = path.join(sessionDir, 'input-merged.mp4')

    fs.writeFileSync(appendSrcPath, Buffer.from(await file.arrayBuffer()))

    const { mergeVideos } = await import('@/lib/ffmpeg-server')
    await mergeVideos([existingPath, appendSrcPath], mergedPath)

    // 後処理: 一時ファイルを削除 → merged を input.mp4 に昇格
    fs.unlinkSync(appendSrcPath)
    fs.unlinkSync(existingPath)
    fs.renameSync(mergedPath, path.join(sessionDir, 'input.mp4'))

    const merged = fs.readFileSync(path.join(sessionDir, 'input.mp4'))
    return new NextResponse(merged, {
      headers: { 'Content-Type': 'video/mp4' },
    })
  } catch (err) {
    console.error('Append error:', err)
    return NextResponse.json({ error: 'Append failed' }, { status: 500 })
  }
}
