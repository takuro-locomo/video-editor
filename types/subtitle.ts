export interface SubtitleSegment {
  id: string
  startTime: number // 秒
  endTime: number   // 秒
  text: string
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
}

export interface TranscribeResult {
  segments: SubtitleSegment[]
  language: string
  duration: number
}
