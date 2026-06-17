'use client'
import { useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { SubtitleSegment } from '@/types/subtitle'

type DragInfo = {
  type: 'move' | 'left' | 'right'
  segId: string
  clientX0: number
  time0start: number
  time0end: number
}

export function SubtitleTimeline() {
  const {
    segments, duration, currentTime, trimStart, trimEnd,
    updateSegment, saveToHistory,
  } = useEditorStore()

  const containerRef = useRef<HTMLDivElement>(null)
  // keep drag state in both ref (for event handlers) and state (for re-render)
  const dragRef = useRef<DragInfo | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  if (duration === 0 || segments.length === 0) return null

  const getPps = () => {
    const w = containerRef.current?.clientWidth ?? 800
    return Math.max(w / Math.max(duration, 1), 4)
  }

  const startDrag = (
    e: React.PointerEvent,
    seg: SubtitleSegment,
    type: DragInfo['type'],
  ) => {
    e.stopPropagation()
    saveToHistory()
    containerRef.current?.setPointerCapture(e.pointerId)
    const info: DragInfo = {
      type, segId: seg.id, clientX0: e.clientX,
      time0start: seg.startTime, time0end: seg.endTime,
    }
    dragRef.current = info
    setDraggingId(seg.id)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const pps = getPps()
    const dt = (e.clientX - d.clientX0) / pps

    if (d.type === 'move') {
      const segDur = d.time0end - d.time0start
      const newStart = Math.max(0, Math.min(d.time0start + dt, (duration || 999) - segDur))
      updateSegment(d.segId, { startTime: newStart, endTime: newStart + segDur })
    } else if (d.type === 'left') {
      const newStart = Math.max(0, Math.min(d.time0start + dt, d.time0end - 0.1))
      updateSegment(d.segId, { startTime: newStart })
    } else {
      const newEnd = Math.max(d.time0start + 0.1, Math.min(d.time0end + dt, duration || 999))
      updateSegment(d.segId, { endTime: newEnd })
    }
  }

  const onPointerUp = () => {
    dragRef.current = null
    setDraggingId(null)
  }

  const pps = getPps()
  const totalPx = Math.max(duration * pps, containerRef.current?.clientWidth ?? 300)

  return (
    <div
      ref={containerRef}
      className="mt-2 relative h-14 bg-gray-900 border border-gray-800 rounded-lg overflow-x-auto overflow-y-hidden select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="absolute inset-y-0" style={{ width: totalPx }}>
        {/* trim shading */}
        {trimStart !== null && trimStart > 0 && (
          <div
            className="absolute inset-y-0 bg-black/50 pointer-events-none"
            style={{ left: 0, width: trimStart * pps }}
          />
        )}
        {trimEnd !== null && trimEnd < duration && (
          <div
            className="absolute inset-y-0 bg-black/50 pointer-events-none"
            style={{ left: trimEnd * pps, right: 0 }}
          />
        )}

        {/* segment bars */}
        {segments.map((seg) => {
          const left = seg.startTime * pps
          const width = Math.max((seg.endTime - seg.startTime) * pps, 6)
          const active = draggingId === seg.id
          return (
            <div
              key={seg.id}
              className={`absolute top-2 bottom-2 rounded group touch-none z-10
                ${active ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-500'}`}
              style={{ left, width, cursor: 'grab' }}
              onPointerDown={(e) => startDrag(e, seg, 'move')}
            >
              {/* resize left edge */}
              <div
                className="absolute left-0 top-0 bottom-0 w-2.5 z-20 cursor-w-resize opacity-0 group-hover:opacity-100 bg-white/20 rounded-l"
                onPointerDown={(e) => { e.stopPropagation(); startDrag(e, seg, 'left') }}
              />
              <span className="px-2 text-[9px] text-white truncate pointer-events-none select-none block overflow-hidden h-full leading-10">
                {seg.text}
              </span>
              {/* resize right edge */}
              <div
                className="absolute right-0 top-0 bottom-0 w-2.5 z-20 cursor-e-resize opacity-0 group-hover:opacity-100 bg-white/20 rounded-r"
                onPointerDown={(e) => { e.stopPropagation(); startDrag(e, seg, 'right') }}
              />
            </div>
          )
        })}

        {/* playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-30"
          style={{ left: currentTime * pps }}
        />
      </div>
    </div>
  )
}
