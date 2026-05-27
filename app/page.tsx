'use client'
import { useEditorStore } from '@/store/editorStore'
import { VideoUploader } from '@/components/upload/VideoUploader'
import { EditorLayout } from '@/components/editor/EditorLayout'

export default function Home() {
  const { videoUrl } = useEditorStore()
  return videoUrl ? <EditorLayout /> : <VideoUploader />
}
