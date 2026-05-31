import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { ensureSessionDir } from '@/lib/session'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('videos') as File[]

    if (files.length < 2) {
      return NextResponse.json(
        { error: '結合には2本以上の動画が必要です' },
        { status: 400 }
      )
    }

    for (const f of files) {
      if (f.size > 500 * 1024 * 1024) {
        return NextResponse.json(
          { error: `ファイルが大きすぎます（最大500MB）: ${f.name}` },
          { status: 400 }
        )
      }
    }

    const sessionId = uuidv4()
    const sessionDir = ensureSessionDir(sessionId)

    // アップロード順に素材を保存（input. 以外の名前にして getInputPath と衝突させない）
    const srcPaths: string[] = []
    for (let i = 0; i < files.length; i++) {
      const ext = path.extname(files[i].name) || '.mp4'
      const p = path.join(sessionDir, `src-${i}${ext}`)
      fs.writeFileSync(p, Buffer.from(await files[i].arrayBuffer()))
      srcPaths.push(p)
    }

    const inputPath = path.join(sessionDir, 'input.mp4')
    const { mergeVideos } = await import('@/lib/ffmpeg-server')
    await mergeVideos(srcPaths, inputPath)

    // 素材ファイルは削除（結合後の input.mp4 のみ残す）
    for (const p of srcPaths) {
      try {
        fs.unlinkSync(p)
      } catch {}
    }

    const merged = fs.readFileSync(inputPath)
    return new NextResponse(merged, {
      headers: {
        'Content-Type': 'video/mp4',
        'X-Session-Id': sessionId,
      },
    })
  } catch (err) {
    console.error('Merge error:', err)
    return NextResponse.json({ error: 'Merge failed' }, { status: 500 })
  }
}
