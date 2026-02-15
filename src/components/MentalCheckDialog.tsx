import { useState, useEffect, useRef } from 'react'

interface Props {
  itemTitle: string
  onSubmit: (reflection: string) => void
  onCancel: () => void
}

export function MentalCheckDialog({ itemTitle, onSubmit, onCancel }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative bg-wabi-bg border border-wabi-border rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-wabi-border/50">
          <p className="text-xs text-wabi-text-muted">振り返り</p>
          <p className="text-sm font-medium mt-1">{itemTitle}</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-wabi-text-muted">やってみてどうだった？</p>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="感じたことを書く..."
            rows={3}
            className="w-full bg-wabi-surface border border-wabi-border/50 rounded-lg px-3 py-2 text-sm text-wabi-text placeholder:text-wabi-text-muted/40 resize-none focus:outline-none focus:border-wabi-accent/50"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={onCancel}
              className="text-xs text-wabi-text-muted hover:text-wabi-text px-3 py-1.5 rounded-lg cursor-pointer"
            >
              やめる
            </button>
            <button
              onClick={() => text.trim() && onSubmit(text.trim())}
              disabled={!text.trim()}
              className="text-xs text-wabi-text bg-wabi-accent/20 hover:bg-wabi-accent/30 px-4 py-1.5 rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              記録する
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
