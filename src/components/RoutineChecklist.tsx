import { useState } from 'react'
import { useRoutines } from '../contexts/RoutineContext'
import { useExecution } from '../contexts/ExecutionContext'

export function RoutineChecklist() {
  const { selected } = useRoutines()
  const { checkedItems, toggleCheck, getWeight, updateWeight } = useExecution()
  const [expanded, setExpanded] = useState(false)

  if (!selected || selected.phases.length === 0) return null

  return (
    <div>
      {/* フェーズ進捗ドット + 展開トグル */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-wabi-text-muted">今日の状態</span>
          <span className="text-xs text-wabi-text-muted">{expanded ? '閉じる' : '開く'}</span>
        </div>
        <div className="space-y-1.5">
          {selected.phases.map(phase => {
            if (!phase.title) return null
            const phaseDone = phase.items.filter(i => checkedItems[i.id]).length
            const phaseComplete = phaseDone === phase.items.length
            return (
              <div key={phase.id} className={`flex items-center gap-2 ${phaseComplete ? 'opacity-40' : ''}`}>
                <span className="text-xs text-wabi-text-muted w-24 shrink-0 truncate">
                  {phase.title}
                </span>
                <div className="flex items-center gap-1">
                  {phase.items.map(item => (
                    <div
                      key={item.id}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        checkedItems[item.id] ? 'bg-wabi-check' : 'bg-wabi-border'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </button>

      {/* 展開時: 全項目チェックリスト + 重みスライダー */}
      {expanded && (
        <div className="mt-4 space-y-3">
          {selected.phases.map(phase => {
            const phaseDone = phase.items.filter(i => checkedItems[i.id]).length
            const phaseComplete = phaseDone === phase.items.length
            return (
              <div key={phase.id} className={phaseComplete ? 'opacity-40' : ''}>
                {phase.title && (
                  <div className="flex items-center justify-between px-1 mb-1">
                    <span className="text-xs font-medium text-wabi-text-muted">{phase.title}</span>
                    <span className="text-xs text-wabi-text-muted">{phaseDone}/{phase.items.length}</span>
                  </div>
                )}
                {phase.items.map(item => {
                  const checked = !!checkedItems[item.id]
                  const w = getWeight(item.title, item.weight)
                  return (
                    <div key={item.id} className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-wabi-surface/50 transition-colors">
                      {/* チェック */}
                      <button
                        onClick={() => toggleCheck(item.id)}
                        className="shrink-0 cursor-pointer"
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                          checked ? 'bg-wabi-check border-wabi-check' : 'border-wabi-border'
                        }`}>
                          {checked && (
                            <svg width="7" height="6" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </button>

                      {/* タイトル */}
                      <span className={`text-xs flex-1 ${checked ? 'line-through text-wabi-text-muted' : 'text-wabi-text'}`}>
                        {item.title}
                      </span>

                      {/* 重みスライダー */}
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={w}
                          onChange={e => updateWeight(item.title, Number(e.target.value))}
                          className="w-14 h-1 accent-wabi-accent cursor-pointer"
                          style={{ accentColor: '#c4a882' }}
                        />
                        <span className="text-[10px] text-wabi-text-muted w-3 text-center font-mono">{w}</span>
                      </div>

                      {item.duration && (
                        <span className="text-[10px] text-wabi-text-muted/50 shrink-0">{item.duration}分</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
