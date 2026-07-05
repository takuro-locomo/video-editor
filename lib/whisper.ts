import OpenAI from 'openai'
import fs from 'fs'
import { whisperToSegments, wordsToSegments } from './subtitle-parser'
import { TranscribeResult } from '@/types/subtitle'

// モジュール読み込み時ではなく呼び出し時に初期化する（キー未設定でもページ全体が落ちないように）
let openai: OpenAI | null = null
function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY が設定されていません。プロジェクト直下の .env.local に OPENAI_API_KEY=sk-... を記入して、サーバーを再起動してください。'
    )
  }
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openai
}

export async function transcribeAudio(audioPath: string): Promise<TranscribeResult> {
  const response = await getClient().audio.transcriptions.create({
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
