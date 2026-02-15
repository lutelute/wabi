import { useState, useEffect } from 'react'
import { useActionList } from '../contexts/ActionListContext'
import { storage } from '../storage'
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

function getWeekDates(): string[] {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

export function NowFocus() {
  const { actions, checkedItems, timerState, progress } = useActionList()
  const [time, setTime] = useState(formatTime)
  const [weekDone, setWeekDone] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTime(formatTime()), 10_000)
    return () => clearInterval(interval)
  }, [])

  // 今週のほどき数をロード
  useEffect(() => {
    async function loadWeek() {
      const today = new Date().toISOString().slice(0, 10)
      const dates = getWeekDates()
      let total = 0

      for (const date of dates) {
        if (date > today) continue
        if (date === today) {
          total += progress.done
          continue
        }
        const state = await storage.getActionState(date)
        if (state?.checkedItems) {
          total += Object.values(state.checkedItems).filter(Boolean).length
        }
      }
      setWeekDone(total)
    }
    loadWeek()
  }, [progress.done])

  const hodokiStats = progress.total > 0 ? (
    <div className="flex items-center justify-center gap-4 mt-2">
      <span className="text-[10px] text-wabi-text-muted/50">今日のほどき：{progress.done}</span>
      {weekDone > 0 && (
        <span className="text-[10px] text-wabi-text-muted/35">ほどき：今週 {weekDone}</span>
      )}
    </div>
  ) : null

  // タイマー中
  if (timerState?.running) {
    const timerAction = actions.find(a => a.id === timerState.itemId)
    const min = Math.floor(timerState.remaining / 60)
    const sec = timerState.remaining % 60
    return (
      <div className="px-1 text-center">
        <span className="text-4xl font-mono tabular-nums font-light text-wabi-timer tracking-wider">
          {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
        </span>
        {timerAction && (
          <p className="text-xs text-wabi-text-muted mt-1">{timerAction.title}</p>
        )}
        {hodokiStats}
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

  // アクションなし or 全手放し
  if (!currentAction) {
    return (
      <div className="px-1 text-center">
        <span className="text-4xl font-mono tabular-nums font-light text-wabi-text tracking-wider">{time}</span>
        {hodokiStats}
      </div>
    )
  }

  const endTime = currentAction.duration ? addMinutes(time, currentAction.duration) : null

  return (
    <div className="px-1 text-center">
      <div className="flex items-baseline justify-center gap-2">
        <span className="text-4xl font-mono tabular-nums font-light text-wabi-text tracking-wider">{time}</span>
        {endTime && (
          <span className="text-sm text-wabi-text-muted/40 font-mono">→ {endTime}</span>
        )}
      </div>
      <div className="flex items-center justify-center gap-2 mt-1">
        {currentAction.sourcePhaseTitle && (
          <span className="text-[10px] text-wabi-text-muted/40">{currentAction.sourcePhaseTitle}</span>
        )}
        <span className="text-xs text-wabi-text-muted">{currentAction.title}</span>
      </div>
      {hodokiStats}
    </div>
  )
}
