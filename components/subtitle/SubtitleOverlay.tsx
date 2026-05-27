'use client'
import { useEditorStore } from '@/store/editorStore'
import { SubtitleSegment } from '@/types/subtitle'

function findActiveSegment(segments: SubtitleSegment[], currentTime: number) {
  return segments.find(
    (seg) => currentTime >= seg.startTime && currentTime <= seg.endTime
  )
}

export function SubtitleOverlay() {
  const { segments, currentTime } = useEditorStore()
  const active = findActiveSegment(segments, currentTime)

  if (!active) return null

  return (
    <div className="absolute bottom-12 left-0 right-0 flex justify-center px-4 pointer-events-none">
      <span className="bg-black/75 text-white text-lg font-medium px-4 py-2 rounded-lg text-center max-w-xl leading-relaxed">
        {active.text}
      </span>
    </div>
  )
}
