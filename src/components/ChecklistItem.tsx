import { useActionList } from '../contexts/ActionListContext'
import { TimerDisplay } from './TimerDisplay'
import type { RoutineItem } from '../types/routine'

interface ChecklistItemProps {
  item: RoutineItem
}

export function ChecklistItem({ item }: ChecklistItemProps) {
  const { checkedItems, toggleCheck, timerState, startTimer } = useActionList()
  const checked = !!checkedItems[item.id]
  const isTimerActive = timerState?.itemId === item.id && timerState.running

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        checked ? 'opacity-50' : ''
      }`}
    >
      {/* チェックボックス */}
      <button
        onClick={() => toggleCheck(item.id)}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
          checked
            ? 'bg-wabi-check border-wabi-check'
            : 'border-wabi-border hover:border-wabi-accent'
        }`}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* コンテンツ */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${checked ? 'line-through text-wabi-text-muted' : ''}`}>
          {item.title}
        </span>
        {item.time && (
          <span className="text-xs text-wabi-text-muted/60 ml-2 font-mono">{item.time}</span>
        )}
      </div>

      {/* タイマー / 所要時間 */}
      {isTimerActive ? (
        <TimerDisplay />
      ) : item.duration && !checked ? (
        <button
          onClick={() => startTimer(item.id, item.duration!)}
          className="text-xs text-wabi-timer hover:text-wabi-accent cursor-pointer px-2 py-1 rounded hover:bg-wabi-surface transition-colors"
          title="タイマー開始"
        >
          {item.duration}分
        </button>
      ) : item.duration ? (
        <span className="text-xs text-wabi-text-muted">{item.duration}分</span>
      ) : null}
    </div>
  )
}
