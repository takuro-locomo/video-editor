'use client'
import { useEditorStore } from '@/store/editorStore'
import {
  SubtitleFontFamily,
  SubtitlePosition,
  OutputAspect,
  OutputFit,
} from '@/types/subtitle'

const FONT_OPTIONS: { value: SubtitleFontFamily; label: string }[] = [
  { value: 'gothic', label: 'ゴシック' },
  { value: 'mincho', label: '明朝' },
  { value: 'notosans', label: 'Noto Sans' },
]

const POSITION_OPTIONS: { value: SubtitlePosition; label: string }[] = [
  { value: 'top', label: '上' },
  { value: 'middle', label: '中央' },
  { value: 'bottom', label: '下' },
]

const ASPECT_OPTIONS: { value: OutputAspect; label: string }[] = [
  { value: 'original', label: '元のまま' },
  { value: '9:16', label: '9:16 リール' },
  { value: '1:1', label: '1:1 正方形' },
  { value: '16:9', label: '16:9 横長' },
]

const FIT_OPTIONS: { value: OutputFit; label: string }[] = [
  { value: 'pad', label: '全体表示（余白）' },
  { value: 'crop', label: '画面いっぱい（切抜）' },
]

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-gray-400 font-medium">{label}</label>
      {children}
    </div>
  )
}

export function SubtitleStyleSettings() {
  const { subtitleStyle: s, setSubtitleStyle, outputSettings: o, setOutputSettings } =
    useEditorStore()

  return (
    <div className="overflow-y-auto h-full p-4 space-y-5">
      {/* フォント種類 */}
      <Row label="フォント">
        <div className="grid grid-cols-3 gap-1.5">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.value}
              onClick={() => setSubtitleStyle({ fontFamily: f.value })}
              className={`text-sm py-2 rounded-lg border transition-colors
                ${s.fontFamily === f.value
                  ? 'border-blue-500 bg-blue-950/40 text-white'
                  : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Row>

      {/* 文字サイズ */}
      <Row label={`文字サイズ（${s.fontSizePercent}）`}>
        <input
          type="range"
          min={3}
          max={12}
          step={0.5}
          value={s.fontSizePercent}
          onChange={(e) => setSubtitleStyle({ fontSizePercent: Number(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </Row>

      {/* 文字色 */}
      <Row label="文字色">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={s.textColor}
            onChange={(e) => setSubtitleStyle({ textColor: e.target.value })}
            className="w-12 h-9 rounded bg-gray-900 border border-gray-800 cursor-pointer"
          />
          <span className="text-xs text-gray-500 font-mono uppercase">{s.textColor}</span>
        </div>
      </Row>

      {/* 太字・縁取り */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubtitleStyle({ bold: !s.bold })}
          className={`flex-1 text-sm py-2 rounded-lg border transition-colors
            ${s.bold ? 'border-blue-500 bg-blue-950/40 text-white' : 'border-gray-800 bg-gray-900 text-gray-400'}`}
        >
          太字 {s.bold ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={() => setSubtitleStyle({ outline: !s.outline })}
          className={`flex-1 text-sm py-2 rounded-lg border transition-colors
            ${s.outline ? 'border-blue-500 bg-blue-950/40 text-white' : 'border-gray-800 bg-gray-900 text-gray-400'}`}
        >
          縁取り {s.outline ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* 背景 */}
      <Row label="背景">
        <button
          onClick={() => setSubtitleStyle({ backgroundEnabled: !s.backgroundEnabled })}
          className={`w-full text-sm py-2 rounded-lg border transition-colors
            ${s.backgroundEnabled ? 'border-blue-500 bg-blue-950/40 text-white' : 'border-gray-800 bg-gray-900 text-gray-400'}`}
        >
          背景 {s.backgroundEnabled ? 'あり' : 'なし'}
        </button>
        {s.backgroundEnabled && (
          <div className="mt-2 space-y-3 pl-1">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={s.backgroundColor}
                onChange={(e) => setSubtitleStyle({ backgroundColor: e.target.value })}
                className="w-12 h-9 rounded bg-gray-900 border border-gray-800 cursor-pointer"
              />
              <span className="text-xs text-gray-500 font-mono uppercase">{s.backgroundColor}</span>
            </div>
            <div>
              <label className="text-xs text-gray-400">不透明度（{Math.round(s.backgroundOpacity * 100)}%）</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={s.backgroundOpacity}
                onChange={(e) => setSubtitleStyle({ backgroundOpacity: Number(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        )}
      </Row>

      {/* 表示位置 */}
      <Row label="表示位置">
        <div className="grid grid-cols-3 gap-1.5">
          {POSITION_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setSubtitleStyle({ position: p.value })}
              className={`text-sm py-2 rounded-lg border transition-colors
                ${s.position === p.value
                  ? 'border-blue-500 bg-blue-950/40 text-white'
                  : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Row>

      {/* 1行の最大文字数（自動改行） */}
      <Row label={`1行の最大文字数（${s.maxCharsPerLine === 0 ? '制限なし' : s.maxCharsPerLine}）`}>
        <input
          type="range"
          min={0}
          max={40}
          step={1}
          value={s.maxCharsPerLine}
          onChange={(e) => setSubtitleStyle({ maxCharsPerLine: Number(e.target.value) })}
          className="w-full accent-blue-500"
        />
        <p className="text-[11px] text-gray-600">
          横向き動画は20前後、縦動画(リール)は12前後が目安です。
        </p>
      </Row>

      {/* 出力設定（アスペクト比） */}
      <div className="pt-4 mt-1 border-t border-gray-800 space-y-5">
        <p className="text-xs text-gray-300 font-semibold">出力設定</p>

        <Row label="アスペクト比">
          <div className="grid grid-cols-2 gap-1.5">
            {ASPECT_OPTIONS.map((a) => (
              <button
                key={a.value}
                onClick={() => setOutputSettings({ aspect: a.value })}
                className={`text-sm py-2 rounded-lg border transition-colors
                  ${o.aspect === a.value
                    ? 'border-blue-500 bg-blue-950/40 text-white'
                    : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </Row>

        {o.aspect !== 'original' && (
          <Row label="フィット方法">
            <div className="grid grid-cols-2 gap-1.5">
              {FIT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setOutputSettings({ fit: f.value })}
                  className={`text-sm py-2 rounded-lg border transition-colors
                    ${o.fit === f.value
                      ? 'border-blue-500 bg-blue-950/40 text-white'
                      : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Row>
        )}
      </div>
    </div>
  )
}
