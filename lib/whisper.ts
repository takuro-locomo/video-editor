import OpenAI from 'openai'
import fs from 'fs'
import { whisperToSegments } from './subtitle-parser'
import { TranscribeResult } from '@/types/subtitle'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function transcribeAudio(audioPath: string): Promise<TranscribeResult> {
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'whisper-1',
    language: 'ja',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  })

  // verbose_json は segments を持つ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = response as any
  const segments = whisperToSegments(raw.segments ?? [])

  return {
    segments,
    language: raw.language ?? 'ja',
    duration: raw.duration ?? 0,
  }
}
