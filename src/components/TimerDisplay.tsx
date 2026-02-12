import { useExecution } from '../contexts/ExecutionContext'

export function TimerDisplay() {
  const { timerState, stopTimer } = useExecution()

  if (!timerState) return null

  const min = Math.floor(timerState.remaining / 60)
  const sec = timerState.remaining % 60
  const pct = ((timerState.total - timerState.remaining) / timerState.total) * 100

  return (
    <div className="flex items-center gap-2">
      {/* プログレスリング */}
      <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90">
        <circle cx="14" cy="14" r="11" fill="none" stroke="var(--color-wabi-border)" strokeWidth="2" />
        <circle
          cx="14" cy="14" r="11"
          fill="none"
          stroke="var(--color-wabi-timer)"
          strokeWidth="2"
          strokeDasharray={`${2 * Math.PI * 11}`}
          strokeDashoffset={`${2 * Math.PI * 11 * (1 - pct / 100)}`}
          strokeLinecap="round"
        />
      </svg>

      <span className="text-sm font-mono text-wabi-timer tabular-nums">
        {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
      </span>

      <button
        onClick={stopTimer}
        className="text-xs text-wabi-text-muted hover:text-wabi-timer cursor-pointer"
        title="停止"
      >
        ×
      </button>
    </div>
  )
}
