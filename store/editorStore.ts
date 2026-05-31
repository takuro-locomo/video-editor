import { create } from 'zustand'
import { SubtitleSegment, SubtitleStyle, DEFAULT_SUBTITLE_STYLE } from '@/types/subtitle'

function newSegmentId(): string {
  return `seg-${crypto.randomUUID()}`
}

interface EditorState {
  // 動画
  sessionId: string | null
  videoUrl: string | null
  filename: string | null
  duration: number

  // 字幕
  segments: SubtitleSegment[]
  subtitleStyle: SubtitleStyle

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
  setDuration: (duration: number) => void
  setSegments: (segments: SubtitleSegment[]) => void
  setSubtitleStyle: (patch: Partial<SubtitleStyle>) => void
  updateSegment: (id: string, patch: Partial<SubtitleSegment>) => void
  deleteSegment: (id: string) => void
  addSegment: (segment: SubtitleSegment) => void
  addSegmentAt: (time: number) => string // 指定時刻に空字幕を追加し、新IDを返す
  splitSegment: (id: string, atTime: number) => void
  mergeWithNext: (id: string) => void
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
  segments: [],
  subtitleStyle: DEFAULT_SUBTITLE_STYLE,
  currentTime: 0,
  isPlaying: false,
  activeTab: 'video',
  isTranscribing: false,
  isExporting: false,
  transcribeProgress: '',

  setVideo: (sessionId, videoUrl, filename) =>
    set({ sessionId, videoUrl, filename, segments: [] }),
  setDuration: (duration) => set({ duration }),
  setSegments: (segments) => set({ segments }),
  setSubtitleStyle: (patch) =>
    set((s) => ({ subtitleStyle: { ...s.subtitleStyle, ...patch } })),
  updateSegment: (id, patch) =>
    set((s) => ({
      segments: s.segments.map((seg) => (seg.id === id ? { ...seg, ...patch } : seg)),
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
      currentTime: 0,
      isPlaying: false,
    }),
}))
