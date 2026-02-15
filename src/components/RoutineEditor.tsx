import { useState, useEffect, useRef } from 'react'
import { useRoutines } from '../contexts/RoutineContext'

export function RoutineEditor() {
  const { selected, updateRoutineText, updateRoutineMemo } = useRoutines()
  const [text, setText] = useState('')
  const [memo, setMemo] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const memoDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (selected) {
      setText(selected.text)
      setMemo(selected.memo ?? '')
    }
  }, [selected?.id])

  const handleChange = (value: string) => {
    setText(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (selected) updateRoutineText(selected.id, value)
    }, 400)
  }

  const handleMemoChange = (value: string) => {
    setMemo(value)
    if (memoDebounceRef.current) clearTimeout(memoDebounceRef.current)
    memoDebounceRef.current = setTimeout(() => {
      if (selected) updateRoutineMemo(selected.id, value)
    }, 400)
  }

  if (!selected) {
    return (
      <div className="flex items-center justify-center h-64 text-wabi-text-muted text-sm">
        ルーティンを選択してください
      </div>
    )
  }

  const totalItems = selected.phases.flatMap(p => p.items).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{selected.name}</h2>
        <span className="text-xs text-wabi-text-muted">
          {totalItems} 項目
        </span>
      </div>
      <textarea
        value={text}
        onChange={e => handleChange(e.target.value)}
        placeholder={`## 朝の立ち上がり\n- 身体を動かす\n- 静かに座る 10min\n\n## 集中の時間\n- 深い仕事にひとつ取り組む`}
        className="w-full h-96 bg-wabi-surface border border-wabi-border rounded-lg p-4 text-sm leading-relaxed resize-none outline-none focus:border-wabi-accent font-mono"
        spellCheck={false}
      />
      <textarea
        value={memo}
        onChange={e => handleMemoChange(e.target.value)}
        placeholder="メモ（このルーティンについて）"
        rows={3}
        className="w-full bg-wabi-surface border border-wabi-border/50 rounded-lg px-4 py-3 text-xs text-wabi-text placeholder:text-wabi-text-muted/30 resize-none focus:outline-none focus:border-wabi-accent"
      />
      <p className="text-xs text-wabi-text-muted">
        ## でフェーズを区切り、- で項目を書く。時刻や所要時間は任意: - 06:00 ストレッチ 10min
        <br />
        @mental を末尾に付けると振り返り必須の内面ワークに: - 静かに座る 10min @mental
      </p>
    </div>
  )
}
