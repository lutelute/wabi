import { useDay } from '../contexts/DayContext'

export function DailyNote() {
  const { dailyNotes, setDailyNotes } = useDay()

  return (
    <div className="px-1">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-wabi-text-muted">心のメモ</span>
        <span className="text-[9px] text-wabi-text-muted/40">書くと自動で残ります</span>
      </div>
      <textarea
        value={dailyNotes}
        onChange={e => setDailyNotes(e.target.value)}
        placeholder="気づき、考えたこと、なんでも..."
        rows={2}
        className="w-full bg-wabi-surface border border-wabi-border/30 rounded-lg px-3 py-2 text-xs text-wabi-text placeholder:text-wabi-text-muted/30 resize-none focus:outline-none focus:border-wabi-text/20"
      />
    </div>
  )
}
