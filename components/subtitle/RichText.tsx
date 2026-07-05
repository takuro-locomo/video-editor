'use client'
import { RichSpan } from '@/lib/rich-text'

/** 部分装飾スパンをそのままインラインで描画する（改行は whitespace-pre 系で反映） */
export function RichText({ spans }: { spans: RichSpan[] }) {
  return (
    <>
      {spans.map((sp, i) => {
        const hasStyle = sp.color || sp.sizePercent || sp.bold
        if (!hasStyle) return <span key={i}>{sp.text}</span>
        return (
          <span
            key={i}
            style={{
              color: sp.color,
              fontSize: sp.sizePercent ? `${sp.sizePercent}%` : undefined,
              fontWeight: sp.bold ? 800 : undefined,
            }}
          >
            {sp.text}
          </span>
        )
      })}
    </>
  )
}
