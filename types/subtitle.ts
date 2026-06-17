/** テキスト内の一部分に適用するインラインスタイル */
export interface StyleRun {
  from: number            // 文字インデックス（inclusive）
  to: number              // 文字インデックス（exclusive）
  sizeMultiplier?: number // 例: 1.5 → セグメント基準サイズの150%
  color?: string          // #RRGGBB
}

export interface SubtitleSegment {
  id: string
  startTime: number // 秒
  endTime: number   // 秒
  text: string
  styleOverride?: Partial<SubtitleStyle> // このセグメントだけのスタイル上書き
  styleRuns?: StyleRun[]                 // 文字単位のインラインスタイル
}

export type SubtitleFontFamily = 'gothic' | 'mincho' | 'notosans'
export type SubtitlePosition = 'top' | 'middle' | 'bottom'

export interface SubtitleStyle {
  fontFamily: SubtitleFontFamily
  fontSizePercent: number // 動画の高さに対する文字サイズの割合(%) 例: 6 = 高さの6%
  textColor: string       // #RRGGBB
  bold: boolean
  outline: boolean        // 縁取り（黒フチ）
  backgroundEnabled: boolean
  backgroundColor: string // #RRGGBB
  backgroundOpacity: number // 0〜1
  position: SubtitlePosition
  maxCharsPerLine: number // 1行の最大文字数（0=制限なし）。超えたら自動改行
}

export type OutputAspect = 'original' | '9:16' | '1:1' | '16:9'
export type OutputFit = 'pad' | 'crop' // pad=全体を表示(余白) / crop=画面いっぱい(切り抜き)

export interface OutputSettings {
  aspect: OutputAspect
  fit: OutputFit
}

export const DEFAULT_OUTPUT_SETTINGS: OutputSettings = {
  aspect: 'original',
  fit: 'pad',
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: 'gothic',
  fontSizePercent: 6,
  textColor: '#FFFFFF',
  bold: true,
  outline: true,
  backgroundEnabled: false,
  backgroundColor: '#000000',
  backgroundOpacity: 0.6,
  position: 'bottom',
  maxCharsPerLine: 0,
}

export interface TranscribeResult {
  segments: SubtitleSegment[]
  language: string
  duration: number
}
