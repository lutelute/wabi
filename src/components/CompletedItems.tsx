import { useState } from 'react'
import { useActionList } from '../contexts/ActionListContext'
import type { Mood } from '../types/routine'

const MOOD_LABEL: Record<Mood, string> = {
  heavy: '重い', cloudy: 'もやもや', flat: 'ふつう', calm: '穏やか', light: '軽い',
}

export function CompletedItems() {
  const { actions, checkedItems, itemMoods, mentalCompletions } = useActionList()
  const [collapsed, setCollapsed] = useState(false)

  const completedActions = actions.filter(a => checkedItems[a.id])

  if (completedActions.length === 0) return null

  return (
    <div className="px-1">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex items-center justify-between w-full text-left cursor-pointer mb-2"
      >
        <span className="text-xs text-wabi-text-muted">
          完了 ({completedActions.length})
        </span>
        <span className="text-[10px] text-wabi-text-muted/50">
          {collapsed ? '開く' : '閉じる'}
        </span>
      </button>

      {!collapsed && (
        <div className="bg-wabi-surface/50 rounded-lg border border-wabi-border/30 p-3 space-y-2">
          {completedActions.map(action => {
            const mood = itemMoods[action.id] as Mood | undefined
            const mc = mentalCompletions.find(m => m.itemId === action.id)
            return (
              <div key={action.id}>
                <div className="flex items-center gap-1.5 text-xs text-wabi-text-muted">
                  <span className="text-wabi-check">-</span>
                  <span className="line-through opacity-60">{action.title}</span>
                  {action.isMental && (
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
