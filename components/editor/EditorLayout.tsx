'use client'
import { useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { VideoPlayer } from './VideoPlayer'
import { Toolbar } from './Toolbar'
import { SubtitleEditor } from '@/components/subtitle/SubtitleEditor'
import { SubtitleStyleSettings } from '@/components/subtitle/SubtitleStyleSettings'

export function EditorLayout() {
  const { activeTab, setActiveTab } = useEditorStore()
  const [rightPanel, setRightPanel] = useState<'list' | 'style'>('list')

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
          {/* 字幕リスト / デザイン 切替 */}
          <div className="flex border-b border-gray-800">
            {([
              { key: 'list', label: '字幕リスト' },
              { key: 'style', label: '🎨 デザイン' },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setRightPanel(t.key)}
                className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors
                  ${rightPanel === t.key
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-500 hover:text-gray-300'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            {rightPanel === 'list' ? <SubtitleEditor /> : <SubtitleStyleSettings />}
          </div>
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
