import { SubtitleSegment } from '@/types/subtitle'
import { secondsToSrtTime } from './time-utils'

/** SubtitleSegment[] を SRT 文字列に変換 */
export function segmentsToSrt(segments: SubtitleSegment[]): string {
  return segments
    .map((seg, i) => {
      const start = secondsToSrtTime(seg.startTime)
      const end = secondsToSrtTime(seg.endTime)
      return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`
    })
    .join('\n')
}

/** Whisper の verbose_json レスポンスを SubtitleSegment[] に変換 */
export function whisperToSegments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whisperSegments: any[]
): SubtitleSegment[] {
  return whisperSegments.map((seg, i) => ({
    id: `seg-${i}`,
    startTime: seg.start,
    endTime: seg.end,
    text: seg.text.trim(),
  }))
}
