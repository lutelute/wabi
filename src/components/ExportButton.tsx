import { useState, useCallback, useMemo } from 'react'
import { useDay } from '../contexts/DayContext'
import { useActionList } from '../contexts/ActionListContext'
import { useRoutines } from '../contexts/RoutineContext'
import { buildDailyNoteMarkdown } from '../utils/dailyNoteExport'
import { DailyNotePreview } from './DailyNotePreview'

export function ExportButton() {
  const dayState = useDay()
  const { declined, checkedItems, itemMoods, mentalCompletions } = useActionList()
  const { selected } = useRoutines()
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)

  const execState = useMemo(() => ({
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
  }), [selected, dayState.date, checkedItems, declined, itemMoods, mentalCompletions])

  const markdown = useMemo(() => {
    return buildDailyNoteMarkdown(dayState, execState, selected ?? null)
  }, [dayState, execState, selected])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [markdown])

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setShowPreview(true)}
          className="text-[10px] text-wabi-text-muted/50 hover:text-wabi-text-muted cursor-pointer px-1.5 py-1 rounded transition-colors hover:bg-wabi-surface"
          title="プレビュー"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h16v12H2z" />
            <path d="M6 8h8M6 11h5" />
          </svg>
        </button>
        <button
          onClick={handleCopy}
          className={`text-[10px] px-1.5 py-1 rounded cursor-pointer transition-all ${
            copied
              ? 'text-emerald-600 bg-emerald-600/10'
              : 'text-wabi-text-muted/50 hover:text-wabi-text-muted hover:bg-wabi-surface'
          }`}
          title="Obsidian形式でコピー"
        >
          {copied ? '✓' : 'Export'}
        </button>
      </div>

      {showPreview && (
        <DailyNotePreview
          markdown={markdown}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  )
}
