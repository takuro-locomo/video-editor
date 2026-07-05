import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getInputPath, getSessionDir } from '@/lib/session'
import { segmentsToAss } from '@/lib/subtitle-parser'
import {
  SubtitleSegment,
  SubtitleStyle,
  TrimRange,
  DEFAULT_SUBTITLE_STYLE,
  OutputSettings,
  DEFAULT_OUTPUT_SETTINGS,
} from '@/types/subtitle'

export const runtime = 'nodejs'
export const maxDuration = 600

/**
 * 複数保持区間に合わせて字幕タイムスタンプを再マップ。
 * 区間ごとに出力上の開始オフセットを計算し、各字幕を適切な時刻に移動する。
 */
function remapSegmentsForRanges(
  segments: SubtitleSegment[],
  ranges: TrimRange[]
): SubtitleSegment[] {
  if (ranges.length === 0) return segments

  // 各区間の出力開始時刻（秒）
  const offsets: number[] = []
  let acc = 0
  for (const r of ranges) {
    offsets.push(acc)
    acc += r.end - r.start
  }

  const result: SubtitleSegment[] = []
  for (const seg of segments) {
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i]
      if (seg.endTime <= r.start || seg.startTime >= r.end) continue
      const outStart = offsets[i] + Math.max(0, seg.startTime - r.start)
      const outEnd = offsets[i] + Math.min(r.end, seg.endTime) - r.start
      result.push({ ...seg, id: `${seg.id}-r${i}`, startTime: outStart, endTime: outEnd })
    }
  }
  return result
}

export async function POST(req: NextRequest) {
  try {
    const {
      sessionId,
      segments,
      style,
      output,
      trimRanges,
    }: {
      sessionId: string
      segments: SubtitleSegment[]
      style?: SubtitleStyle
      output?: OutputSettings
      trimRanges?: TrimRange[]
    } = await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const inputPath = getInputPath(sessionId)
    const sessionDir = getSessionDir(sessionId)
    const assPath = path.join(sessionDir, 'subtitles.ass')
    const outputPath = path.join(os.tmpdir(), `output-${sessionId}.mp4`)

    const { burnSubtitlesMultiRange, getVideoDimensions, computeTargetDimensions } = await import(
      '@/lib/ffmpeg-server'
    )
    const { width, height, fps, hasAudio } = await getVideoDimensions(inputPath)
    const outputSettings = output ?? DEFAULT_OUTPUT_SETTINGS
    const target = computeTargetDimensions(outputSettings.aspect, width, height)

    const activeRanges = (trimRanges ?? []).filter((r) => r.end > r.start)
    const exportSegments = activeRanges.length > 0
      ? remapSegmentsForRanges(segments, activeRanges)
      : segments

    const assDims = target ?? { width, height }
    const subtitleStyle = style ?? DEFAULT_SUBTITLE_STYLE
    fs.writeFileSync(
      assPath,
      segmentsToAss(exportSegments, subtitleStyle, assDims.width, assDims.height),
      'utf-8'
    )

    await burnSubtitlesMultiRange(
      inputPath,
      assPath,
      outputPath,
      activeRanges,
      target ? { ...target, fit: outputSettings.fit } : undefined,
      fps,
      hasAudio
    )

    const fileBuffer = fs.readFileSync(outputPath)
    fs.unlinkSync(outputPath)

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
