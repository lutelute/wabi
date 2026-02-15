import { useState } from 'react'
import { useRoutines } from '../contexts/RoutineContext'
import { useExecution } from '../contexts/ExecutionContext'
import type { Mood } from '../types/routine'

const MOOD_LABEL: Record<Mood, string> = {
  heavy: '重い', cloudy: 'もやもや', flat: 'ふつう', calm: '穏やか', light: '軽い',
}

export function CompletedItems() {
  const { selected } = useRoutines()
  const { checkedItems, itemMoods, mentalCompletions } = useExecution()
  const [collapsed, setCollapsed] = useState(false)

  if (!selected) return null

  const phases = selected.phases
    .map(phase => ({
      ...phase,
      completedItems: phase.items.filter(i => checkedItems[i.id]),
    }))
    .filter(p => p.completedItems.length > 0)

  if (phases.length === 0) return null

  const totalCompleted = phases.reduce((s, p) => s + p.completedItems.length, 0)

  return (
    <div className="px-1">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex items-center justify-between w-full text-left cursor-pointer mb-2"
      >
        <span className="text-xs text-wabi-text-muted">
          完了 ({totalCompleted})
        </span>
        <span className="text-[10px] text-wabi-text-muted/50">
          {collapsed ? '開く' : '閉じる'}
        </span>
      </button>

      {!collapsed && (
        <div className="bg-wabi-surface/50 rounded-lg border border-wabi-border/30 p-3 space-y-2">
          {phases.map(phase => (
            <div key={phase.id}>
              {phase.title && (
                <p className="text-[10px] text-wabi-text-muted/50 mb-1">{phase.title}</p>
              )}
              <ul className="space-y-1">
                {phase.completedItems.map(item => {
                  const mood = itemMoods[item.id] as Mood | undefined
                  const mc = mentalCompletions.find(m => m.itemId === item.id)
                  return (
                    <li key={item.id} className="text-xs text-wabi-text-muted">
                      <div className="flex items-center gap-1.5">
                        <span className="text-wabi-check">-</span>
                        <span className="line-through opacity-60">{item.title}</span>
                        {item.isMental && (
                          <span className="text-[9px] text-amber-600/50 bg-amber-500/10 px-1 py-px rounded">mental</span>
                        )}
                        {mood && (
                          <span className="text-[10px] bg-wabi-bg px-1 py-0.5 rounded">{MOOD_LABEL[mood]}</span>
                        )}
                      </div>
                      {mc && (
                        <p className="text-[10px] text-wabi-text-muted/60 italic ml-4 mt-0.5">
                          {mc.reflection}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
