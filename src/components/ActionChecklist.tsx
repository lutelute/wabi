import { useState, useRef, useCallback } from 'react'
import { useActionList } from '../contexts/ActionListContext'
import { useSettings } from '../contexts/SettingsContext'
import { useDay } from '../contexts/DayContext'
import { MentalCheckDialog } from './MentalCheckDialog'
import { MOOD_OPTIONS } from '../types/routine'
import type { Mood, DailyAction } from '../types/routine'

const LONG_PRESS_MS = 1500

export function ActionChecklist() {
  const {
    actions, checkedItems, toggleCheck, getWeight, updateWeight,
    removeAction, renameAction,
    itemMoods, itemComments, setItemMood, setItemComment, addMentalCompletion,
    timerState, startTimer, stopTimer,
  } = useActionList()
  const { settings } = useSettings()
  const { markRestTaken } = useDay()
  const [mentalDialog, setMentalDialog] = useState<DailyAction | null>(null)
  const [showWeights, setShowWeights] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [commentingId, setCommentingId] = useState<string | null>(null)
  const weightMax = settings.weightMax || 5

  if (actions.length === 0) {
    return (
      <div className="px-1 py-6 text-center">
        <p className="text-xs text-wabi-text-muted/50">サイドバーからアイテムを追加してください</p>
      </div>
    )
  }

  const doneCount = actions.filter(a => checkedItems[a.id]).length

  const completeAction = (action: DailyAction) => {
    toggleCheck(action.id)
    if (action.isRest) markRestTaken()
  }

  const handleCheck = (action: DailyAction) => {
    if (checkedItems[action.id]) {
      toggleCheck(action.id)
      return
    }
    if (action.isMental) {
      setMentalDialog(action)
      return
    }
    if (action.duration) {
      startTimer(action.id, action.duration)
      return
    }
    completeAction(action)
  }

  const handleDirectComplete = (action: DailyAction) => {
    if (action.isMental) {
      setMentalDialog(action)
      return
    }
    completeAction(action)
  }

  const handleTimerComplete = (action: DailyAction) => {
    stopTimer()
    if (action.isMental) {
      setMentalDialog(action)
    } else {
      completeAction(action)
    }
  }

  const handleMentalSubmit = (reflection: string) => {
    if (!mentalDialog) return
    if (timerState?.running && timerState.itemId === mentalDialog.id) {
      stopTimer()
    }
    completeAction(mentalDialog)
    addMentalCompletion(mentalDialog.id, reflection)
    setMentalDialog(null)
  }

  // フェーズ別にグループ化（表示用）
  const groups: { routineName: string; phaseTitle: string; actions: DailyAction[] }[] = []
  for (const action of actions) {
    const key = `${action.sourceRoutineId}:${action.sourcePhaseTitle}`
    const existing = groups.find(g => `${g.actions[0].sourceRoutineId}:${g.actions[0].sourcePhaseTitle}` === key)
    if (existing) {
      existing.actions.push(action)
    } else {
      groups.push({ routineName: action.sourceRoutineName, phaseTitle: action.sourcePhaseTitle, actions: [action] })
    }
  }

  return (
    <div className="px-1">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-wabi-text-muted">
          侘び <span className="font-mono text-wabi-text-muted/50">{doneCount}/{actions.length}</span>
        </span>
        <button
          onClick={() => setShowWeights(v => !v)}
          className="text-[10px] text-wabi-text-muted/50 hover:text-wabi-text-muted cursor-pointer"
        >
          {showWeights ? '重み非表示' : '重み'}
        </button>
      </div>

      {/* リスト */}
      <div className="space-y-1">
        {groups.map((group, gi) => {
          const phaseDone = group.actions.filter(a => checkedItems[a.id]).length
          const phaseComplete = phaseDone === group.actions.length
          return (
            <div key={gi}>
              {group.phaseTitle && (
                <div className={`flex items-center justify-between px-1 py-1 ${phaseComplete ? 'opacity-40' : ''}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-wabi-text-muted">{group.phaseTitle}</span>
                    <span className="text-[9px] text-wabi-text-muted/40 relative">
                      {group.routineName}
                      {group.actions[0]?.sourceRoutineColor && (
                        <span className="absolute left-0 right-0 bottom-0 h-[40%] rounded-sm" style={{ backgroundColor: group.actions[0].sourceRoutineColor, opacity: 0.18 }} />
                      )}
                    </span>
                  </div>
                  <span className="text-[10px] text-wabi-text-muted/50">{phaseDone}/{group.actions.length}</span>
                </div>
              )}
              {group.actions.map(action => {
                const checked = !!checkedItems[action.id]
                const w = getWeight(action.title, action.weight)
                const mood = itemMoods[action.id] as Mood | undefined
                const isTimerActive = timerState?.running && timerState.itemId === action.id

                return (
                  <div
                    key={action.id}
                    className={`group/action rounded-lg transition-colors ${
                      isTimerActive
                        ? 'bg-wabi-surface border border-wabi-border'
                        : checked
                          ? 'opacity-50'
                          : 'hover:bg-wabi-surface/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 px-2 py-2">
                      {/* チェックボックス */}
                      {action.isMental && !checked ? (
                        <LongPressCheck
                          onComplete={() => {
                            if (action.duration && !isTimerActive) {
                              startTimer(action.id, action.duration)
                              return
                            }
                            setMentalDialog(action)
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => handleCheck(action)}
                          className="shrink-0 cursor-pointer"
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                            checked ? 'bg-wabi-check border-wabi-check' : 'border-wabi-border hover:border-wabi-text-muted'
                          }`}>
                            {checked && (
                              <svg width="8" height="7" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                        </button>
                      )}

                      {/* タイトル + ソース */}
                      <div className="flex-1 min-w-0">
                        {editingId === action.id ? (
                          <input
                            autoFocus
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            onBlur={() => {
                              if (editTitle.trim()) renameAction(action.id, editTitle.trim())
                              setEditingId(null)
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                if (editTitle.trim()) renameAction(action.id, editTitle.trim())
                                setEditingId(null)
                              }
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="text-xs text-wabi-text bg-transparent outline-none border-b border-wabi-accent w-full"
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span
                              className={`text-xs cursor-text ${checked ? 'line-through text-wabi-text-muted' : 'text-wabi-text'}`}
                              onDoubleClick={() => {
                                setEditingId(action.id)
                                setEditTitle(action.title)
                              }}
                            >
                              {action.title}
                            </span>
                            <span className="text-[8px] text-wabi-text-muted/30 truncate">
                              <span className="relative">
                                {action.sourceRoutineName}
                                {action.sourceRoutineColor && (
                                  <span className="absolute left-0 right-0 bottom-0 h-[40%] rounded-sm" style={{ backgroundColor: action.sourceRoutineColor, opacity: 0.18 }} />
                                )}
                              </span>
                              {' > '}{action.sourcePhaseTitle}
                            </span>
                            {action.isMental && (
                              <span className="text-[8px] text-amber-600/60 bg-amber-500/8 px-1 rounded">mental</span>
                            )}
                            {action.isRest && (
                              <span className="text-[8px] text-indigo-500/60 bg-indigo-500/8 px-1 rounded">rest</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* duration あり & 未手放し */}
                      {action.duration && !checked && !isTimerActive && (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-wabi-text-muted/40 font-mono">{action.duration}分</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDirectComplete(action)
                            }}
                            className="text-[10px] text-wabi-text-muted/40 hover:text-wabi-check cursor-pointer px-1 py-0.5 rounded hover:bg-wabi-surface transition-colors"
                            title="タイマーなしで手放す"
                          >
                            skip
                          </button>
                        </div>
                      )}

                      {/* 重みスライダー */}
                      {showWeights && !checked && (
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="range"
                            min={1}
                            max={weightMax}
                            value={w}
                            onChange={e => updateWeight(action.title, Number(e.target.value))}
                            className="w-12 h-1 accent-wabi-accent cursor-pointer"
                            style={{ accentColor: '#c4a882' }}
                          />
                          <span className="text-[10px] text-wabi-text-muted w-3 text-center font-mono">{w}</span>
                        </div>
                      )}

                      {/* 削除ボタン */}
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          removeAction(action.id)
                        }}
                        className="opacity-0 group-hover/action:opacity-100 shrink-0 text-wabi-text-muted/40 hover:text-wabi-timer text-xs cursor-pointer px-0.5 transition-opacity"
                        title="削除"
                      >
                        ×
                      </button>
                    </div>

                    {/* タイマー表示 */}
                    {isTimerActive && timerState && (
                      <TimerInline
                        remaining={timerState.remaining}
                        total={timerState.total}
                        action={action}
                        onComplete={() => handleTimerComplete(action)}
                        onStop={stopTimer}
                      />
                    )}

                    {/* 手放した後: 気持ちボタン */}
                    {checked && (
                      <div className="flex gap-0.5 px-8 pb-1">
                        {MOOD_OPTIONS.map(({ value, label }) => (
                          <button
                            key={value}
                            onClick={() => setItemMood(action.id, value)}
                            className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer transition-colors ${
                              mood === value
                                ? 'bg-wabi-accent/20 text-wabi-text'
                                : 'text-wabi-text-muted/50 hover:text-wabi-text-muted hover:bg-wabi-surface'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* コメント欄 (コンパクト: クリックで展開) */}
                    {commentingId === action.id ? (
                      <div className="px-8 pb-1.5">
                        <input
                          autoFocus
                          value={itemComments[action.id] ?? ''}
                          onChange={e => setItemComment(action.id, e.target.value)}
                          onBlur={() => setCommentingId(null)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) setCommentingId(null)
                            if (e.key === 'Escape') setCommentingId(null)
                          }}
                          placeholder="ひとこと"
                          className="w-full text-[10px] bg-transparent border-b border-wabi-accent/40 text-wabi-text-muted placeholder:text-wabi-text-muted/30 focus:outline-none py-0.5"
                        />
                      </div>
                    ) : itemComments[action.id] ? (
                      <div
                        className="px-8 pb-1 cursor-text"
                        onClick={() => setCommentingId(action.id)}
                      >
                        <span className="text-[10px] text-wabi-text-muted/50">{itemComments[action.id]}</span>
                      </div>
                    ) : (
                      <div
                        className="px-8 pb-0.5 opacity-0 group-hover/action:opacity-100 transition-opacity cursor-text"
                        onClick={() => setCommentingId(action.id)}
                      >
                        <span className="text-[10px] text-wabi-text-muted/20">+ ひとこと</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* @mental 振り返りダイアログ */}
      {mentalDialog && (
        <MentalCheckDialog
          itemTitle={mentalDialog.title}
          onSubmit={handleMentalSubmit}
          onCancel={() => setMentalDialog(null)}
        />
      )}
    </div>
  )
}

/** インラインタイマー表示 */
function TimerInline({ remaining, total, action, onComplete, onStop }: {
  remaining: number
  total: number
  action: DailyAction
  onComplete: () => void
  onStop: () => void
}) {
  const min = Math.floor(remaining / 60)
  const sec = remaining % 60
  const ratio = total > 0 ? (total - remaining) / total : 0

  return (
    <div className="px-8 pb-3 space-y-2">
      <div className="h-1 bg-wabi-border/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-wabi-timer rounded-full transition-all duration-1000"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-lg font-mono font-light tabular-nums text-wabi-timer">
          {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
        </span>
        <div className="flex gap-2">
          <button
            onClick={onStop}
            className="text-[10px] text-wabi-text-muted hover:text-wabi-text cursor-pointer px-2 py-1 rounded border border-wabi-border hover:border-wabi-text-muted transition-colors"
          >
            中止
          </button>
          {action.isMental ? (
            <LongPressButton label="手放す" onComplete={onComplete} />
          ) : (
            <button
              onClick={onComplete}
              className="text-[10px] text-wabi-check hover:text-wabi-accent cursor-pointer px-2 py-1 rounded border border-wabi-border hover:border-wabi-accent transition-colors"
            >
              手放す
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** 長押しチェックボタン (丸) */
function LongPressCheck({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>(null)
  const startRef = useRef(0)

  const start = useCallback(() => {
    startRef.current = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const p = Math.min(1, elapsed / LONG_PRESS_MS)
      setProgress(p)
      if (p >= 1) {
        stop()
        onComplete()
      }
    }, 30)
  }, [onComplete])

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setProgress(0)
  }, [])

  const r = 6
  const circumference = 2 * Math.PI * r
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <button
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      onTouchCancel={stop}
      className="shrink-0 cursor-pointer relative"
      title="長押しで手放す"
    >
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-wabi-border" />
        <circle
          cx="8" cy="8" r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-amber-500 transition-none"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
      </svg>
    </button>
  )
}

/** 長押し手放すボタン (テキスト) */
function LongPressButton({ label, onComplete }: { label: string; onComplete: () => void }) {
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>(null)
  const startRef = useRef(0)

  const start = useCallback(() => {
    startRef.current = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const p = Math.min(1, elapsed / LONG_PRESS_MS)
      setProgress(p)
      if (p >= 1) {
        stop()
        onComplete()
      }
    }, 30)
  }, [onComplete])

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setProgress(0)
  }, [])

  return (
    <button
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      onTouchCancel={stop}
      className="relative text-[10px] text-amber-600 hover:text-amber-500 cursor-pointer px-2 py-1 rounded border border-amber-500/30 hover:border-amber-500/50 transition-colors overflow-hidden"
    >
      {progress > 0 && (
        <div
          className="absolute inset-0 bg-amber-500/15 transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      )}
      <span className="relative">{label}</span>
    </button>
  )
}
