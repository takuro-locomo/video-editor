'use client'
import { useCallback, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'

export function VideoUploader() {
  const { setVideo } = useEditorStore()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])

  const addFiles = useCallback((list: FileList | File[]) => {
    const vids = Array.from(list).filter((f) => f.type.startsWith('video/'))
    if (vids.length === 0) {
      setError('動画ファイルを選択してください')
      return
    }
    setError(null)
    setFiles((prev) => [...prev, ...vids])
  }, [])

  const move = (i: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const remove = (i: number) =>
    setFiles((prev) => prev.filter((_, idx) => idx !== i))

  const start = useCallback(async () => {
    if (files.length === 0) return
    setIsUploading(true)
    setError(null)

    try {
      if (files.length === 1) {
        // 単一動画: そのままアップロード（再エンコードなし）
        setProgress('アップロード中...')
        const fd = new FormData()
        fd.append('video', files[0])
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!res.ok) throw new Error(await res.text())
        const { sessionId } = await res.json()
        setVideo(sessionId, URL.createObjectURL(files[0]), files[0].name)
      } else {
        // 複数動画: サーバーで結合
        setProgress('動画を結合中...（少し時間がかかります）')
        const fd = new FormData()
        files.forEach((f) => fd.append('videos', f))
        const res = await fetch('/api/merge', { method: 'POST', body: fd })
        if (!res.ok) throw new Error(await res.text())
        const sessionId = res.headers.get('X-Session-Id')
        if (!sessionId) throw new Error('セッションIDを取得できませんでした')
        const blob = await res.blob()
        setVideo(sessionId, URL.createObjectURL(blob), '結合動画.mp4')
      }
    } catch (err) {
      setError(files.length > 1 ? '結合に失敗しました' : 'アップロードに失敗しました')
      console.error(err)
    } finally {
      setIsUploading(false)
      setProgress('')
    }
  }, [files, setVideo])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
    },
    [addFiles]
  )

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 p-4">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-white text-center mb-2">動画編集AI</h1>
        <p className="text-gray-400 text-center mb-8">
          動画をアップロードしてAI字幕を生成・複数動画は結合できます
        </p>

        <div
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors
            ${isDragging ? 'border-blue-400 bg-blue-950/30' : 'border-gray-700 hover:border-gray-500 bg-gray-900'}`}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <div className="space-y-2">
            <div className="text-5xl">🎬</div>
            <p className="text-white font-medium">動画をドラッグ&ドロップ</p>
            <p className="text-gray-500 text-sm">または クリックして選択（複数可）</p>
            <p className="text-gray-600 text-xs">MP4, MOV, AVI, MKV 対応 / 各最大500MB</p>
          </div>
        </div>

        {/* 選択された動画リスト */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.length > 1 && (
              <p className="text-xs text-gray-500">
                上から順に結合されます。↑↓ で並べ替えできます。
              </p>
            )}
            {files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2"
              >
                <span className="text-xs text-gray-500 w-5">{i + 1}</span>
                <span className="flex-1 text-sm text-gray-200 truncate">{f.name}</span>
                {files.length > 1 && (
                  <>
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="text-gray-400 hover:text-white disabled:opacity-30 px-1"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === files.length - 1}
                      className="text-gray-400 hover:text-white disabled:opacity-30 px-1"
                    >
                      ↓
                    </button>
                  </>
                )}
                <button
                  onClick={() => remove(i)}
                  className="text-gray-500 hover:text-red-400 px-1"
                >
                  ✕
                </button>
              </div>
            ))}

            <button
              onClick={start}
              disabled={isUploading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {progress || '処理中...'}
                </>
              ) : files.length > 1 ? (
                `${files.length}本を結合して編集する`
              ) : (
                'この動画を編集する'
              )}
            </button>
          </div>
        )}

        {error && <p className="mt-4 text-red-400 text-center text-sm">{error}</p>}
      </div>
    </div>
  )
}
