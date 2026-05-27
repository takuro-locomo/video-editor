'use client'
import { useEffect, useRef } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { SubtitleOverlay } from '@/components/subtitle/SubtitleOverlay'

export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { videoUrl, setCurrentTime, setDuration, setIsPlaying } = useEditorStore()

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) return
    video.src = videoUrl
  }, [videoUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTime = () => setCurrentTime(video.currentTime)
    const onMeta = () => setDuration(video.duration)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
    }
  }, [setCurrentTime, setDuration, setIsPlaying])

  if (!videoUrl) return null

  return (
    <div className="relative bg-black rounded-xl overflow-hidden aspect-video w-full">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        playsInline
      />
      <SubtitleOverlay />
    </div>
  )
}
