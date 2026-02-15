import { useExecution } from '../contexts/ExecutionContext'
import { useDay } from '../contexts/DayContext'
import { useRoutines } from '../contexts/RoutineContext'
import type { Mood } from '../types/routine'

const MOOD_LABEL: Record<Mood, string> = {
  heavy: '重い', cloudy: 'もやもや', flat: 'ふつう', calm: '穏やか', light: '軽い',
}

export function DailySummary() {
  const { selected } = useRoutines()
  const { checkedItems, itemMoods, declined, progress, mentalCompletions } = useExecution()
  const { moodLog, dailyNotes, staminaLog, mentalLog, checkIns } = useDay()

  const completedItems = selected?.phases
    .flatMap(p => p.items)
    .filter(i => checkedItems[i.id]) ?? []

  const hasAny = completedItems.length > 0 || moodLog.length > 0 || staminaLog.length > 0 || mentalLog.length > 0 || checkIns.length > 0

  if (!hasAny) return null

  return (
    <div className="px-1">
      <p className="text-xs text-wabi-text-muted mb-3">今日のまとめ</p>

      <div className="bg-wabi-surface rounded-lg border border-wabi-border/50 p-4 space-y-3 text-xs">
        {/* 体力・心 */}
        {(staminaLog.length > 0 || mentalLog.length > 0) && (
          <div className="space-y-1">
            {staminaLog.length > 0 && (
              <div className="flex gap-1 items-baseline text-wabi-text-muted flex-wrap">
                <span className="w-10 shrink-0 text-emerald-600">体力</span>
                {staminaLog.map((e, i) => (
                  <span key={i} className="font-mono text-[10px]">
                    {i > 0 && <span className="mx-0.5 opacity-30">→</span>}
                    <span className="opacity-40">{e.time}</span> {e.level}
                  </span>
                ))}
              </div>
            )}
            {mentalLog.length > 0 && (
              <div className="flex gap-1 items-baseline text-wabi-text-muted flex-wrap">
                <span className="w-10 shrink-0 text-sky-500">心</span>
                {mentalLog.map((e, i) => (
                  <span key={i} className="font-mono text-[10px]">
                    {i > 0 && <span className="mx-0.5 opacity-30">→</span>}
                    <span className="opacity-40">{e.time}</span> {e.level}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 気分の流れ */}
        {moodLog.length > 0 && (
          <div className="flex gap-1 flex-wrap items-center text-wabi-text-muted">
            <span className="w-10 shrink-0">気分</span>
            {moodLog.map((e, i) => (
              <span key={i} className="bg-wabi-bg px-1.5 py-0.5 rounded text-[10px]">
                {MOOD_LABEL[e.mood]}
              </span>
            ))}
          </div>
        )}

        {/* 完了タスク + 気持ち */}
        {completedItems.length > 0 && (
          <div>
            <p className="text-wabi-text-muted mb-1">
              {progress.done}/{progress.total} 完了
            </p>
            <ul className="space-y-0.5">
              {completedItems.map(item => {
                const mood = itemMoods[item.id] as Mood | undefined
                const mc = mentalCompletions.find(m => m.itemId === item.id)
                return (
                  <li key={item.id} className="text-wabi-text-muted">
                    <div className="flex items-center gap-1.5">
                      <span className="text-wabi-check">-</span>
                      <span>{item.title}</span>
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
        )}

        {/* やらないこと */}
        {declined && (
          <div className="text-wabi-text-muted">
            <span className="opacity-50">手放したこと:</span> {declined}
          </div>
        )}

        {/* 心のメモ */}
        {dailyNotes && (
          <div className="text-wabi-text-muted italic">
            {dailyNotes}
          </div>
        )}

        {/* チェックイン履歴 */}
        {checkIns.length > 0 && (
          <div className="space-y-1">
            <span className="text-wabi-text-muted opacity-50">チェックイン</span>
            {checkIns.map((ci, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-wabi-text-muted flex-wrap">
                <span className="font-mono opacity-40">{ci.time}</span>
                <span className="text-emerald-600">{ci.stamina}</span>
                <span className="text-sky-500">{ci.mental}</span>
                {ci.tags.map(t => (
                  <span key={t} className="bg-wabi-bg px-1 py-0.5 rounded">#{t}</span>
                ))}
                {ci.comment && <span className="italic opacity-60">{ci.comment}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
