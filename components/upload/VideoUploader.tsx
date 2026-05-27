'use client'
import { useCallback, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'

export function VideoUploader() {
  const { setVideo } = useEditorStore()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('動画ファイルを選択してください')
      return
    }
    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('video', file)

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text())

      const { sessionId } = await res.json()
      const videoUrl = URL.createObjectURL(file)
      setVideo(sessionId, videoUrl, file.name)
    } catch (err) {
      setError('アップロードに失敗しました')
      console.error(err)
    } finally {
      setIsUploading(false)
    }
  }, [setVideo])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }, [upload])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 p-4">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-white text-center mb-2">動画編集AI</h1>
        <p className="text-gray-400 text-center mb-8">動画をアップロードしてAI字幕を生成</p>

        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors
            ${isDragging ? 'border-blue-400 bg-blue-950/30' : 'border-gray-700 hover:border-gray-500 bg-gray-900'}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />

          {isUploading ? (
            <div className="space-y-3">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-400">アップロード中...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-5xl">🎬</div>
              <p className="text-white font-medium">動画をドラッグ&ドロップ</p>
              <p className="text-gray-500 text-sm">または クリックしてファイルを選択</p>
              <p className="text-gray-600 text-xs">MP4, MOV, AVI, MKV 対応 / 最大500MB</p>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 text-red-400 text-center text-sm">{error}</p>
        )}
      </div>
    </div>
  )
}
