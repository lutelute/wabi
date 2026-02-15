import { useState, useCallback } from 'react'

interface Props {
  markdown: string
  onClose: () => void
}

export function DailyNotePreview({ markdown, onClose }: Props) {
  const [copied, setCopied] = useState<'all' | 'frontmatter' | null>(null)

  const frontmatter = extractFrontmatter(markdown)

  const handleCopy = useCallback((target: 'all' | 'frontmatter') => {
    const text = target === 'frontmatter' && frontmatter ? frontmatter : markdown
    navigator.clipboard.writeText(text).then(() => {
      setCopied(target)
      setTimeout(() => setCopied(null), 2000)
    })
  }, [markdown, frontmatter])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-wabi-surface rounded-xl border border-wabi-border shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-wabi-border">
          <h3 className="text-sm font-medium text-wabi-text">デイリーノート プレビュー</h3>
          <button
            onClick={onClose}
            className="text-wabi-text-muted hover:text-wabi-text cursor-pointer text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* 本文 */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <pre className="text-xs text-wabi-text font-mono whitespace-pre-wrap leading-relaxed">
            {markdown}
          </pre>
        </div>

        {/* アクション */}
        <div className="flex gap-2 px-4 py-3 border-t border-wabi-border">
          <button
            onClick={() => handleCopy('all')}
            className={`flex-1 py-2 rounded-md text-xs transition-all duration-200 ${
              copied === 'all'
                ? 'bg-emerald-600/20 text-emerald-600'
                : 'bg-wabi-bg hover:bg-wabi-border/30 text-wabi-text-muted'
            }`}
          >
            {copied === 'all' ? 'コピーしました' : '全文コピー'}
          </button>
          {frontmatter && (
            <button
              onClick={() => handleCopy('frontmatter')}
              className={`flex-1 py-2 rounded-md text-xs transition-all duration-200 ${
                copied === 'frontmatter'
                  ? 'bg-emerald-600/20 text-emerald-600'
                  : 'bg-wabi-bg hover:bg-wabi-border/30 text-wabi-text-muted'
              }`}
            >
              {copied === 'frontmatter' ? 'コピーしました' : 'frontmatterのみ'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function extractFrontmatter(md: string): string | null {
  const match = md.match(/^---\n[\s\S]*?\n---/)
  return match ? match[0] : null
}
