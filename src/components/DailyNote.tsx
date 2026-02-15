import { useState, useCallback, useMemo } from 'react'
import { useDay } from '../contexts/DayContext'
import { useActionList } from '../contexts/ActionListContext'
import { useRoutines } from '../contexts/RoutineContext'
import { buildDailyNoteMarkdown } from '../utils/dailyNoteExport'
import { DailyNotePreview } from './DailyNotePreview'
import type { Mood } from '../types/routine'

const MOOD_LABEL: Record<Mood, string> = {
  heavy: '重い', cloudy: 'もやもや', flat: 'ふつう', calm: '穏やか', light: '軽い',
}

export function DailyNote() {
  const dayState = useDay()
  const { declined, progress, checkedItems, itemMoods, mentalCompletions } = useActionList()
  const { selected } = useRoutines()
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)

  const execState = useMemo(() => {
    return {
      routineId: selected?.id ?? '',
      date: dayState.date,
      checkedItems,
      itemWeights: {},
      timerState: null,
      declined,
      moodLog: [],
      moodNote: '',
      itemMoods,
      staminaLog: [],
      mentalLog: [],
      checkIns: [],
      mentalCompletions,
      dismissedConcepts: [],
    }
  }, [selected, dayState.date, checkedItems, declined, itemMoods, mentalCompletions])

  const markdown = useMemo(() => {
    return buildDailyNoteMarkdown(dayState, execState, selected ?? null)
  }, [dayState, execState, selected])

  const handleExport = useCallback(() => {
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [markdown])

  const hasSummary = dayState.staminaLog.length > 0 || dayState.mentalLog.length > 0
    || dayState.moodLog.length > 0 || dayState.checkIns.length > 0

  return (
    <div className="px-1">
      <p className="text-xs text-wabi-text-muted mb-3">デイリーノート</p>

      <div className="bg-wabi-surface rounded-lg border border-wabi-border/50 p-4 space-y-3">
        {/* テキストエリア */}
        <textarea
          value={dayState.dailyNotes}
          onChange={e => dayState.setDailyNotes(e.target.value)}
          placeholder="手放したこと、気づき、なんでも..."
          rows={3}
          className="w-full bg-wabi-bg border border-wabi-border/50 rounded-md px-3 py-2 text-xs text-wabi-text placeholder:text-wabi-text-muted/40 resize-none focus:outline-none focus:border-wabi-text/20"
        />

        {/* アクションボタン */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(true)}
            className="flex-1 py-2 rounded-md text-xs bg-wabi-bg hover:bg-wabi-border/30 text-wabi-text-muted transition-colors"
          >
            プレビュー
          </button>
          <button
            onClick={handleExport}
            className={`flex-1 py-2 rounded-md text-xs transition-all duration-200 ${
              copied
                ? 'bg-emerald-600/20 text-emerald-600'
                : 'bg-wabi-bg hover:bg-wabi-border/30 text-wabi-text-muted'
            }`}
          >
            {copied ? 'コピーしました' : 'Obsidian形式でコピー'}
          </button>
        </div>

        {/* 自動サマリー */}
        {hasSummary && (
          <div className="pt-2 border-t border-wabi-border/30 space-y-2 text-xs">
            {/* 体力・心ログ */}
            {dayState.staminaLog.length > 0 && (
              <div className="flex gap-1 items-baseline text-wabi-text-muted flex-wrap">
                <span className="w-10 shrink-0 text-emerald-600">体力</span>
                {dayState.staminaLog.map((e, i) => (
                  <span key={i} className="font-mono text-[10px]">
                    {i > 0 && <span className="mx-0.5 opacity-30">→</span>}
                    <span className="opacity-40">{e.time}</span> {e.level}
                  </span>
                ))}
              </div>
            )}
            {dayState.mentalLog.length > 0 && (
              <div className="flex gap-1 items-baseline text-wabi-text-muted flex-wrap">
                <span className="w-10 shrink-0 text-sky-500">心</span>
                {dayState.mentalLog.map((e, i) => (
                  <span key={i} className="font-mono text-[10px]">
                    {i > 0 && <span className="mx-0.5 opacity-30">→</span>}
                    <span className="opacity-40">{e.time}</span> {e.level}
                  </span>
                ))}
              </div>
            )}

            {/* 気分タイムライン */}
            {dayState.moodLog.length > 0 && (
              <div className="flex gap-1 flex-wrap items-center text-wabi-text-muted">
                <span className="w-10 shrink-0">気分</span>
                {dayState.moodLog.map((e, i) => (
                  <span key={i} className="bg-wabi-bg px-1.5 py-0.5 rounded text-[10px]">
                    {MOOD_LABEL[e.mood]}
                  </span>
                ))}
              </div>
            )}

            {/* チェックイン数 + 完了率 */}
            <div className="flex gap-4 text-[10px] text-wabi-text-muted">
              {dayState.checkIns.length > 0 && (
                <span>チェックイン: {dayState.checkIns.length}回</span>
              )}
              {progress.total > 0 && (
                <span>完了: {progress.done}/{progress.total}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* プレビューモーダル */}
      {showPreview && (
        <DailyNotePreview
          markdown={markdown}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}
