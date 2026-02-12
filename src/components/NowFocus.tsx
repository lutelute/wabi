import { useState, useEffect } from 'react'
import { useRoutines } from '../contexts/RoutineContext'
import { useExecution } from '../contexts/ExecutionContext'
import type { RoutineItem } from '../types/routine'

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
  const { selected } = useRoutines()
  const { checkedItems, timerState, toggleCheck, startTimer, progress } = useExecution()
  const [time, setTime] = useState(formatTime)

  useEffect(() => {
    const interval = setInterval(() => setTime(formatTime()), 10_000)
    return () => clearInterval(interval)
  }, [])

  if (!selected) return null

  // タイマー中
  if (timerState?.running) {
    const allItems = selected.phases.flatMap(p => p.items)
    const timerItem = allItems.find(i => i.id === timerState.itemId)
    const phase = selected.phases.find(p => p.items.some(i => i.id === timerState.itemId))
    const min = Math.floor(timerState.remaining / 60)
    const sec = timerState.remaining % 60
    return (
      <div className="bg-wabi-surface rounded-xl p-6 border border-wabi-border">
        <div className="flex items-start justify-between">
          <p className="text-4xl font-mono font-light tabular-nums text-wabi-timer">
            {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
          </p>
          {phase?.title && (
            <span className="text-xs text-wabi-text-muted">{phase.title}</span>
          )}
        </div>
        <p className="text-lg font-medium mt-4">{timerItem?.title}</p>
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-wabi-text-muted">
            {progress.done} / {progress.total}
          </span>
          <button
            onClick={() => timerItem && toggleCheck(timerItem.id)}
            className="text-xs text-wabi-check hover:text-wabi-accent cursor-pointer px-3 py-1.5 rounded-lg border border-wabi-border hover:border-wabi-accent transition-colors"
          >
            完了
          </button>
        </div>
      </div>
    )
  }

  // 現在のタスクを探す
  let currentItem: RoutineItem | null = null
  let currentPhaseTitle = ''
  for (const phase of selected.phases) {
    for (const item of phase.items) {
      if (!checkedItems[item.id]) {
        currentItem = item
        currentPhaseTitle = phase.title
        break
      }
    }
    if (currentItem) break
  }

  // 全完了
  if (!currentItem) {
    if (progress.total === 0) return null
    return (
      <div className="bg-wabi-surface rounded-xl p-6 border border-wabi-border">
        <p className="text-4xl font-mono font-light tabular-nums text-wabi-text">{time}</p>
        <p className="text-sm text-wabi-check mt-4">すべて完了</p>
      </div>
    )
  }

  const endTime = currentItem.duration ? addMinutes(time, currentItem.duration) : null

  return (
    <div className="bg-wabi-surface rounded-xl p-6 border border-wabi-border">
      {/* 時刻 + フェーズ */}
      <div className="flex items-start justify-between">
        <p className="text-4xl font-mono font-light tabular-nums text-wabi-text">{time}</p>
        {currentPhaseTitle && (
          <span className="text-xs text-wabi-text-muted mt-1">{currentPhaseTitle}</span>
        )}
      </div>

      {/* タスク名 */}
      <p className="text-lg font-medium mt-4">{currentItem.title}</p>

      {/* 時間計算 + アクション */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-3">
          {endTime && (
            <span className="text-xs text-wabi-text-muted font-mono">
              {time} → {endTime}
            </span>
          )}
          {currentItem.duration && !timerState?.running && (
            <button
              onClick={() => startTimer(currentItem!.id, currentItem!.duration!)}
              className="text-xs text-wabi-timer hover:text-wabi-accent cursor-pointer px-2 py-1 rounded border border-wabi-border hover:border-wabi-accent transition-colors"
            >
              {currentItem.duration}分 タイマー
            </button>
          )}
        </div>
        <button
          onClick={() => toggleCheck(currentItem!.id)}
          className="text-xs text-wabi-check hover:text-wabi-accent cursor-pointer px-3 py-1.5 rounded-lg border border-wabi-border hover:border-wabi-accent transition-colors"
        >
          完了
        </button>
      </div>

      {/* 進捗 */}
      <div className="mt-3 pt-3 border-t border-wabi-border/50">
        <span className="text-xs text-wabi-text-muted">
          {progress.done} / {progress.total}
        </span>
      </div>
    </div>
  )
}
