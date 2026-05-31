import OpenAI from 'openai'
import fs from 'fs'
import { whisperToSegments, wordsToSegments } from './subtitle-parser'
import { TranscribeResult } from '@/types/subtitle'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function transcribeAudio(audioPath: string): Promise<TranscribeResult> {
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'whisper-1',
    language: 'ja',
    response_format: 'verbose_json',
    // 単語単位のタイムスタンプも取得し、発話に沿った短い字幕に組み直す
    timestamp_granularities: ['word', 'segment'],
  })

  // verbose_json は segments / words を持つ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = response as any
  // 単語タイムスタンプがあれば発話区間ベースで生成、無ければ segment 単位にフォールバック
  const segments =
    Array.isArray(raw.words) && raw.words.length > 0
      ? wordsToSegments(raw.words)
      : whisperToSegments(raw.segments ?? [])

  return {
    segments,
    language: raw.language ?? 'ja',
    duration: raw.duration ?? 0,
  }
}
