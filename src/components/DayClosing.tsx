import { useDay } from '../contexts/DayContext'
import { useActionList } from '../contexts/ActionListContext'

export function DayClosing() {
  const { checkIns, moodLog, closedAt, closeDay } = useDay()
  const { progress } = useActionList()

  // 何もしていなければ表示しない
  const hasActivity = checkIns.length > 0 || progress.total > 0 || moodLog.length > 0
  if (!hasActivity) return null

  if (closedAt) {
    const t = new Date(closedAt)
    const hh = String(t.getHours()).padStart(2, '0')
    const mm = String(t.getMinutes()).padStart(2, '0')
    return (
      <div className="px-1">
        <div className="bg-wabi-surface rounded-lg border border-wabi-border/50 p-4 text-center space-y-1">
          <p className="text-xs text-wabi-text-muted">今日はここまで</p>
          <p className="text-[10px] text-wabi-text-muted/40 font-mono">{hh}:{mm} に閉じました</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-1">
      <button
        onClick={closeDay}
        className="w-full py-2.5 rounded-lg text-xs text-wabi-text-muted/50 hover:text-wabi-text-muted hover:bg-wabi-surface border border-transparent hover:border-wabi-border/30 transition-all duration-200 cursor-pointer"
      >
        今日を閉じる
      </button>
    </div>
  )
}
