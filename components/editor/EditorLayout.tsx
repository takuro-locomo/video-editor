'use client'
import { useEditorStore } from '@/store/editorStore'
import { VideoPlayer } from './VideoPlayer'
import { Toolbar } from './Toolbar'
import { SubtitleEditor } from '@/components/subtitle/SubtitleEditor'

export function EditorLayout() {
  const { activeTab, setActiveTab } = useEditorStore()

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <Toolbar />

      {/* PC: 横2ペイン / スマホ: タブ切替 */}
      <div className="flex flex-1 overflow-hidden">

        {/* 動画エリア（PCは常時表示、スマホはタブ選択時のみ） */}
        <div className={`flex flex-col flex-1 p-4 overflow-hidden
          md:flex ${activeTab === 'video' ? 'flex' : 'hidden md:flex'}`}>
          <VideoPlayer />
        </div>

        {/* 区切り線（PCのみ） */}
        <div className="hidden md:block w-px bg-gray-800" />

        {/* 字幕エリア（PCは常時表示、スマホはタブ選択時のみ） */}
        <div className={`flex flex-col md:w-96 overflow-hidden
          ${activeTab === 'subtitles' ? 'flex flex-1' : 'hidden md:flex'}`}>
          <div className="hidden md:block px-3 py-2 border-b border-gray-800">
            <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wide">字幕リスト</h2>
          </div>
          <SubtitleEditor />
        </div>
      </div>

      {/* スマホ用タブバー */}
      <div className="md:hidden flex border-t border-gray-800 bg-gray-900">
        {(['video', 'subtitles'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium transition-colors
              ${activeTab === tab ? 'text-blue-400 border-t-2 border-blue-400' : 'text-gray-500'}`}
          >
            {tab === 'video' ? '🎬 動画' : '📝 字幕'}
          </button>
        ))}
      </div>
    </div>
  )
}
