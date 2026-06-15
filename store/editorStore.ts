import { create } from 'zustand'
import {
  SubtitleSegment,
  SubtitleStyle,
  StyleRun,
  DEFAULT_SUBTITLE_STYLE,
  OutputSettings,
  DEFAULT_OUTPUT_SETTINGS,
} from '@/types/subtitle'

function newSegmentId(): string {
  return `seg-${crypto.randomUUID()}`
}

interface EditorState {
  // 動画
  sessionId: string | null
  videoUrl: string | null
  filename: string | null
  duration: number
  naturalWidth: number
  naturalHeight: number

  // プレビュー（実機の見え方確認）
  previewDevice: 'normal' | 'iphone16pro'
  previewOrientation: 'portrait' | 'landscape'

  // 字幕
  segments: SubtitleSegment[]
  subtitleStyle: SubtitleStyle
  outputSettings: OutputSettings

  // トリミング（1区間。null=未設定で全体を使用）
  trimStart: number | null
  trimEnd: number | null

  // 再生状態
  currentTime: number
  isPlaying: boolean

  // UI状態
  activeTab: 'video' | 'subtitles' | 'settings'
  isTranscribing: boolean
  isExporting: boolean
  transcribeProgress: string

  // アクション
  setVideo: (sessionId: string, videoUrl: string, filename: string) => void
  setVideoUrl: (videoUrl: string) => void
  setDuration: (duration: number) => void
  setNaturalSize: (width: number, height: number) => void
  setPreviewDevice: (device: 'normal' | 'iphone16pro') => void
  setPreviewOrientation: (orientation: 'portrait' | 'landscape') => void
  setSegments: (segments: SubtitleSegment[]) => void
  setSubtitleStyle: (patch: Partial<SubtitleStyle>) => void
  setOutputSettings: (patch: Partial<OutputSettings>) => void
  updateSegment: (id: string, patch: Partial<SubtitleSegment>) => void
  updateSegmentStyle: (id: string, patch: Partial<SubtitleStyle> | null) => void
  updateSegmentRuns: (id: string, runs: StyleRun[]) => void
  deleteSegment: (id: string) => void
  addSegment: (segment: SubtitleSegment) => void
  addSegmentAt: (time: number) => string // 指定時刻に空字幕を追加し、新IDを返す
  splitSegment: (id: string, atTime: number) => void
  mergeWithNext: (id: string) => void
  setTrimStart: (time: number | null) => void
  setTrimEnd: (time: number | null) => void
  resetTrim: () => void
  setCurrentTime: (time: number) => void
  setIsPlaying: (playing: boolean) => void
  setActiveTab: (tab: 'video' | 'subtitles' | 'settings') => void
  setIsTranscribing: (v: boolean) => void
  setIsExporting: (v: boolean) => void
  setTranscribeProgress: (msg: string) => void
  reset: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  sessionId: null,
  videoUrl: null,
  filename: null,
  duration: 0,
  naturalWidth: 0,
  naturalHeight: 0,
  previewDevice: 'normal',
  previewOrientation: 'portrait',
  segments: [],
  subtitleStyle: DEFAULT_SUBTITLE_STYLE,
  outputSettings: DEFAULT_OUTPUT_SETTINGS,
  trimStart: null,
  trimEnd: null,
  currentTime: 0,
  isPlaying: false,
  activeTab: 'video',
  isTranscribing: false,
  isExporting: false,
  transcribeProgress: '',

  setVideo: (sessionId, videoUrl, filename) =>
    set({ sessionId, videoUrl, filename, segments: [], trimStart: null, trimEnd: null }),
  setVideoUrl: (videoUrl) => set({ videoUrl }),
  setDuration: (duration) => set({ duration }),
  setNaturalSize: (naturalWidth, naturalHeight) => set({ naturalWidth, naturalHeight }),
  setPreviewDevice: (previewDevice) => set({ previewDevice }),
  setPreviewOrientation: (previewOrientation) => set({ previewOrientation }),
  setSegments: (segments) => set({ segments }),
  setSubtitleStyle: (patch) =>
    set((s) => ({ subtitleStyle: { ...s.subtitleStyle, ...patch } })),
  setOutputSettings: (patch) =>
    set((s) => ({ outputSettings: { ...s.outputSettings, ...patch } })),
  updateSegment: (id, patch) =>
    set((s) => ({
      segments: s.segments.map((seg) => (seg.id === id ? { ...seg, ...patch } : seg)),
    })),
  updateSegmentStyle: (id, patch) =>
    set((s) => ({
      segments: s.segments.map((seg) =>
        seg.id === id
          ? { ...seg, styleOverride: patch === null ? undefined : { ...seg.styleOverride, ...patch } }
          : seg
      ),
    })),
  updateSegmentRuns: (id, runs) =>
    set((s) => ({
      segments: s.segments.map((seg) =>
        seg.id === id ? { ...seg, styleRuns: runs.length ? runs : undefined } : seg
      ),
    })),
  deleteSegment: (id) =>
    set((s) => ({ segments: s.segments.filter((seg) => seg.id !== id) })),
  addSegment: (segment) =>
    set((s) => ({
      segments: [...s.segments, segment].sort((a, b) => a.startTime - b.startTime),
    })),
  addSegmentAt: (time) => {
    const id = newSegmentId()
    set((s) => {
      const endTime = Math.min(time + 2, s.duration || time + 2)
      const seg: SubtitleSegment = { id, startTime: time, endTime, text: '' }
      return {
        segments: [...s.segments, seg].sort((a, b) => a.startTime - b.startTime),
      }
    })
    return id
  },
  splitSegment: (id, atTime) =>
    set((s) => {
      const seg = s.segments.find((x) => x.id === id)
      if (!seg || atTime <= seg.startTime || atTime >= seg.endTime) return s
      const first: SubtitleSegment = { ...seg, endTime: atTime }
      const second: SubtitleSegment = {
        id: newSegmentId(),
        startTime: atTime,
        endTime: seg.endTime,
        text: '',
      }
      return {
        segments: s.segments
          .flatMap((x) => (x.id === id ? [first, second] : [x]))
          .sort((a, b) => a.startTime - b.startTime),
      }
    }),
  mergeWithNext: (id) =>
    set((s) => {
      const i = s.segments.findIndex((x) => x.id === id)
      if (i === -1 || i === s.segments.length - 1) return s
      const cur = s.segments[i]
      const next = s.segments[i + 1]
      const merged: SubtitleSegment = {
        ...cur,
        endTime: next.endTime,
        text: [cur.text, next.text].filter(Boolean).join(' '),
      }
      return {
        segments: s.segments
          .filter((_, idx) => idx !== i && idx !== i + 1)
          .concat(merged)
          .sort((a, b) => a.startTime - b.startTime),
      }
    }),
  setTrimStart: (trimStart) => set({ trimStart }),
  setTrimEnd: (trimEnd) => set({ trimEnd }),
  resetTrim: () => set({ trimStart: null, trimEnd: null }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setIsTranscribing: (isTranscribing) => set({ isTranscribing }),
  setIsExporting: (isExporting) => set({ isExporting }),
  setTranscribeProgress: (transcribeProgress) => set({ transcribeProgress }),
  reset: () =>
    set({
      sessionId: null,
      videoUrl: null,
      filename: null,
      duration: 0,
      segments: [],
      trimStart: null,
      trimEnd: null,
      currentTime: 0,
      isPlaying: false,
    }),
}))
