import { useDay } from '../contexts/DayContext'
import { useActionList } from '../contexts/ActionListContext'

export function DayClosing() {
  const { checkIns, moodLog, closedAt, closeDay, reopenDay } = useDay()
  const { progress, actions } = useActionList()

  // 閉じた後: 再開ボタン付き
  if (closedAt) {
    const t = new Date(closedAt)
    const hh = String(t.getHours()).padStart(2, '0')
    const mm = String(t.getMinutes()).padStart(2, '0')
    return (
      <div className="px-1">
        <div className="bg-wabi-surface rounded-lg border border-wabi-border/50 p-4 text-center space-y-2">
          <p className="text-xs text-wabi-text-muted">今日はここまで</p>
          <p className="text-[10px] text-wabi-text-muted/40 font-mono">{hh}:{mm} に閉じました</p>
          <button
            onClick={reopenDay}
            className="text-[10px] text-wabi-text-muted/40 hover:text-wabi-text-muted cursor-pointer transition-colors"
          >
            再開する
          </button>
        </div>
      </div>
    )
  }

  // アクティビティがあれば「閉じる」ボタン
  const hasActivity = checkIns.length > 0 || progress.total > 0 || moodLog.length > 0
  if (hasActivity) {
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

  // アクションが追加されていない: 「今日を始める」的な案内
  if (actions.length === 0) {
    return (
      <div className="px-1">
        <div className="text-center py-4">
          <p className="text-xs text-wabi-text-muted/40">サイドバーからルーティンを選んで始めましょう</p>
        </div>
      </div>
    )
  }

  return null
}
