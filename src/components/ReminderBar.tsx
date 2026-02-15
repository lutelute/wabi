import { useState } from 'react'
import { useReminders } from '../contexts/ReminderContext'

export function ReminderBar() {
  const { pendingReminders, dismissReminder, snoozeReminder, addReminder } = useReminders()
  const [expanded, setExpanded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newTime, setNewTime] = useState('')

  if (pendingReminders.length === 0 && !adding) return null

  const handleAdd = () => {
    if (!newSubject.trim() || !newTime) return
    addReminder(newSubject.trim(), newTime)
    setNewSubject('')
    setNewTime('')
    setAdding(false)
  }

  return (
    <div className="bg-wabi-surface/60 border border-wabi-border/40 rounded-lg overflow-hidden transition-all">
      {/* 薄いバー */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer"
      >
        <span className="text-[10px] text-amber-600/70 shrink-0">
          {pendingReminders.length > 0 ? `${pendingReminders.length}件` : ''}
        </span>
        <span className="text-xs text-wabi-text-muted truncate flex-1">
          {pendingReminders.map(r => r.subject).join(' / ') || 'リマインダー'}
        </span>
        <span className="text-[10px] text-wabi-text-muted/50">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* 展開部分 */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-wabi-border/30">
          {pendingReminders.map(r => (
            <div key={r.id} className="flex items-start gap-2 pt-2">
              <div className="flex-1">
                <p className="text-xs text-wabi-text">{r.subject}</p>
                {r.body && <p className="text-[10px] text-wabi-text-muted mt-0.5">{r.body}</p>}
                <p className="text-[10px] text-wabi-text-muted/50 font-mono">{r.time}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => snoozeReminder(r.id, 15)}
                  className="text-[10px] text-wabi-text-muted hover:text-wabi-text px-1.5 py-0.5 rounded bg-wabi-bg cursor-pointer"
                >
                  15分後
                </button>
                <button
                  onClick={() => dismissReminder(r.id)}
                  className="text-[10px] text-wabi-text-muted hover:text-wabi-text px-1.5 py-0.5 rounded bg-wabi-bg cursor-pointer"
                >
                  OK
                </button>
              </div>
            </div>
          ))}

          {/* 追加フォーム */}
          {adding ? (
            <div className="pt-2 space-y-1.5">
              <input
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                placeholder="件名"
                className="w-full bg-wabi-bg border border-wabi-border/50 rounded px-2 py-1 text-xs text-wabi-text placeholder:text-wabi-text-muted/40 focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2 items-center">
                <input
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  className="bg-wabi-bg border border-wabi-border/50 rounded px-2 py-1 text-xs text-wabi-text focus:outline-none"
                />
                <button onClick={handleAdd} className="text-[10px] text-wabi-check cursor-pointer">追加</button>
                <button onClick={() => setAdding(false)} className="text-[10px] text-wabi-text-muted cursor-pointer">×</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="text-[10px] text-wabi-text-muted/50 hover:text-wabi-text-muted cursor-pointer pt-1"
            >
              + リマインダー追加
            </button>
          )}
        </div>
      )}
    </div>
  )
}
