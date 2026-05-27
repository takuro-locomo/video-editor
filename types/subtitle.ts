export interface SubtitleSegment {
  id: string
  startTime: number // 秒
  endTime: number   // 秒
  text: string
}

export interface TranscribeResult {
  segments: SubtitleSegment[]
  language: string
  duration: number
}
