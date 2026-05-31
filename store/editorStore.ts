import { create } from 'zustand'
import { SubtitleSegment, SubtitleStyle, DEFAULT_SUBTITLE_STYLE } from '@/types/subtitle'

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
