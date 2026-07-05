import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { ensureSessionDir, getInputPath } from '@/lib/session'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// 編集中の動画の末尾に、新しい動画ファイルを結合する
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const sessionId = formData.get('sessionId') as string | null
    const files = formData.getAll('videos') as File[]

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }
    if (files.length === 0) {
      return NextResponse.json({ error: '追加する動画がありません' }, { status: 400 })
    }
    for (const f of files) {
      if (f.size > 2 * 1024 * 1024 * 1024) {
        return NextResponse.json(
          { error: `ファイルが大きすぎます（最大2GB）: ${f.name}` },
          { status: 400 }
        )
      }
    }

    const currentInput = getInputPath(sessionId)
    const sessionDir = ensureSessionDir(sessionId)

    // 追加素材を保存
    const srcPaths: string[] = []
    for (let i = 0; i < files.length; i++) {
      const ext = path.extname(files[i].name) || '.mp4'
      const p = path.join(sessionDir, `append-src-${i}${ext}`)
      fs.writeFileSync(p, Buffer.from(await files[i].arrayBuffer()))
      srcPaths.push(p)
    }

    // 現在の動画を先頭に、追加動画を末尾に結合
    const mergedPath = path.join(sessionDir, 'merged-tmp.mp4')
    const { mergeVideos } = await import('@/lib/ffmpeg-server')
    await mergeVideos([currentInput, ...srcPaths], mergedPath)

    // 旧 input と素材を削除し、結合結果を新しい input.mp4 に
    fs.unlinkSync(currentInput)
    for (const p of srcPaths) {
      try {
        fs.unlinkSync(p)
      } catch {}
    }
    const newInput = path.join(sessionDir, 'input.mp4')
    fs.renameSync(mergedPath, newInput)

    // 古いプレビューは無効になるので削除（結合結果はそのまま再生できる）
    try {
      fs.unlinkSync(path.join(sessionDir, 'preview.mp4'))
    } catch {}

    return NextResponse.json({ sessionId })
  } catch (err) {
    console.error('Append error:', err)
    const message = err instanceof Error ? err.message : 'Append failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
