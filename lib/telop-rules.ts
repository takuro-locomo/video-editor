import { SafeZonePresetKey } from '@/types/subtitle'

/**
 * テロップ品質ルールのマスターデータ（テロップ機能仕様書 R-01〜R-21）。
 * チェック機能・デフォルト値・自動処理の根拠となる定数。
 */
export const TELOP_RULES = {
  /** R-01 表示速度: 日本語 4文字/秒 */
  readingCharsPerSec: 4,
  /** R-01 表示速度: 英字 12文字/秒 */
  readingCharsPerSecEn: 12,
  /** R-05 視聴者補正係数（編集者は内容を知っているため速く読める） */
  viewerFactor: 1.5,
  /** R-06 1行の文字数（横型）: 16文字を超えたら改行 or 分割 */
  maxCharsPerLineH: 16,
  /** R-07 1行の文字数（縦型9:16） */
  maxCharsPerLineV: 10,
  /** R-08 行数は最大2行 */
  maxLines: 2,
  /** R-09 1画面の総文字数 */
  maxTotalChars: 35,
  /** R-10 コントラスト比（WCAG 2.1） */
  minContrast: 4.5,
  /** R-18 テロップは音声より先行させる（フレーム数、デフォルト2F） */
  leadInFrames: 2,
  /** タイミング計算に使うfps（動画の実fpsが不明なときの想定値） */
  assumedFps: 30,
  /** R-19 話し終わりから1拍（約1秒）後に消す */
  holdAfterSec: 1.0,
  /** R-20 助詞・単位の縮小率（本文の75〜90% → 中間の85%） */
  particleShrinkRatio: 0.85,
  /** F-05 1プロジェクト内のスタイル数がこれを超えたら警告 */
  maxStyleVariants: 4,
  /** F-07 強調は1テロップにつき1〜2箇所まで */
  emphasisMaxPerSegment: 2,
  /** F-07 強調時のサイズ倍率（110〜120% → 115%） */
  emphasisSizeMultiplier: 1.15,
} as const

/** R-04 慣用句：塊で認識できるため読了時間チェックを緩和する定型句 */
export const IDIOM_WHITELIST = [
  'ありがとう',
  'ありがとうございます',
  'ありがとうございました',
  'こんにちは',
  'こんばんは',
  'おはよう',
  'おはようございます',
  'お疲れ様です',
  'お疲れ様でした',
  'よろしくお願いします',
  'すみません',
  'ごめんなさい',
  'いただきます',
  'ごちそうさまでした',
  'さようなら',
  'はじめまして',
]

/**
 * 要約支援（仕様書5章）: 除去対象のフィラー（言いよどみ）。
 * 長い語を先に並べること（前方一致で長い方から消すため）。
 * 「えー」「うーん」単独は意味を持つ場合があるため、直後が句読点・空白のときだけ消す（telop-text側で判定）。
 */
export const FILLER_WORDS = [
  'えーっと', 'えっとー', 'ええっと', 'ええと', 'えーと', 'えっと',
  'あのーー', 'あのー', 'あのう',
  'そのーー', 'そのー', 'そのう',
  'うーんと', 'んーと', 'えーとですね',
]

/** 直後に区切り（句読点・空白・文末）がある場合のみ除去するフィラー */
export const FILLER_WORDS_BOUNDARY = ['えーー', 'えー', 'うーん', 'まぁー', 'まぁ']

/** F-07 キーワード自動強調の辞書（注目を集める語） */
export const EMPHASIS_KEYWORDS = [
  '失敗', '原因', '注意', '重要', '危険', '禁止', 'NG', 'ポイント', 'コツ',
  '絶対', '必ず', '必須', '無料', '限定', '最強', '最悪', '衝撃', '本音',
  '真実', '理由', '結論', '簡単', '話題', '人気', '必見', '損', '得',
  'おすすめ', 'オススメ', '間違い', '正解', '秘密', '禁断',
]

/** セーフゾーンのNG領域（フレームに対する%指定の矩形） */
export interface ZoneRect {
  x: number // 左端（%）
  y: number // 上端（%）
  w: number // 幅（%）
  h: number // 高さ（%）
  label?: string
}

export interface SafeZonePreset {
  label: string
  /** 横型汎用の同心ガイド（%）。文字の芯90% / 座布団93〜95%（R-15） */
  guides?: number[]
  /** テロップを置いてはいけない領域（R-16/R-17） */
  ngZones: ZoneRect[]
}

/**
 * F-04 媒体別セーフゾーン定義。
 * 各SNSのUIは変更されるため、この定義だけ差し替えれば追従できるようにデータとして分離している。
 */
export const SAFE_ZONE_PRESETS: Record<Exclude<SafeZonePresetKey, 'off'>, SafeZonePreset> = {
  landscape: {
    label: '横型汎用（90/93/95%）',
    guides: [90, 93, 95],
    ngZones: [],
  },
  ytshorts: {
    label: 'YouTubeショート',
    ngZones: [
      { x: 0, y: 0, w: 100, h: 10, label: '上部UI' },
      { x: 0, y: 80, w: 100, h: 20, label: 'タイトル・チャンネル帯' },
      { x: 86, y: 40, w: 14, h: 40, label: 'ボタン列' },
    ],
  },
  tiktok: {
    label: 'TikTok',
    ngZones: [
      { x: 0, y: 0, w: 100, h: 8, label: '上部アイコン' },
      { x: 0, y: 75, w: 100, h: 25, label: 'キャプション帯' },
      { x: 87, y: 35, w: 13, h: 45, label: 'ボタン列' },
    ],
  },
  instagram: {
    label: 'Instagramリール',
    ngZones: [
      { x: 0, y: 0, w: 100, h: 14, label: '上部UI' },
      { x: 0, y: 60, w: 100, h: 40, label: '下部UI（広告基準）' },
    ],
  },
}

export const SAFE_ZONE_OPTIONS: { value: SafeZonePresetKey; label: string }[] = [
  { value: 'off', label: 'ガイドなし' },
  { value: 'landscape', label: '横型 90/93/95%' },
  { value: 'ytshorts', label: 'YTショート' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'IGリール' },
]
