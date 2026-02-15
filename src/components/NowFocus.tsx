import { useState, useEffect } from 'react'
import { useActionList } from '../contexts/ActionListContext'
import type { DailyAction } from '../types/routine'

function formatTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function addMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

export function NowFocus() {
  const { actions, checkedItems, timerState, progress } = useActionList()
  const [time, setTime] = useState(formatTime)

  useEffect(() => {
    const interval = setInterval(() => setTime(formatTime()), 10_000)
    return () => clearInterval(interval)
  }, [])

  if (actions.length === 0) return null

  // タイマー中
  if (timerState?.running) {
    const timerAction = actions.find(a => a.id === timerState.itemId)
    const min = Math.floor(timerState.remaining / 60)
    const sec = timerState.remaining % 60
    return (
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-mono tabular-nums text-wabi-timer">
          {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
        </span>
        <span className="text-xs text-wabi-text-muted truncate ml-3">{timerAction?.title}</span>
      </div>
    )
  }

  // 現在のタスクを探す
  let currentAction: DailyAction | null = null
  for (const action of actions) {
    if (!checkedItems[action.id]) {
      currentAction = action
      break
    }
  }

  // 全完了
  if (!currentAction) {
    if (progress.total === 0) return null
    return (
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-mono tabular-nums text-wabi-text">{time}</span>
        <span className="text-xs text-wabi-check">すべて完了</span>
      </div>
    )
  }

  const endTime = currentAction.duration ? addMinutes(time, currentAction.duration) : null

  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono tabular-nums text-wabi-text">{time}</span>
        {endTime && (
          <span className="text-[10px] text-wabi-text-muted/50 font-mono">→ {endTime}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {currentAction.sourcePhaseTitle && (
          <span className="text-[10px] text-wabi-text-muted/40">{currentAction.sourcePhaseTitle}</span>
        )}
        <span className="text-xs text-wabi-text truncate max-w-[180px]">{currentAction.title}</span>
        <span className="text-[10px] text-wabi-text-muted/50 font-mono">{progress.done}/{progress.total}</span>
      </div>
    </div>
  )
}
