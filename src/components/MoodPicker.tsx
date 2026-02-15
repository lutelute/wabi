import { useDay } from '../contexts/DayContext'
import { MOOD_OPTIONS } from '../types/routine'
import type { Mood, MoodEntry } from '../types/routine'

const MOOD_INDEX: Record<Mood, number> = {
  heavy: 0, cloudy: 1, flat: 2, calm: 3, light: 4,
}

const MOOD_LABEL: Record<Mood, string> = {
  heavy: '重い', cloudy: 'もやもや', flat: 'ふつう', calm: '穏やか', light: '軽い',
}

function shiftMessage(log: MoodEntry[]): string | null {
  if (log.length < 2) return null
  const first = MOOD_INDEX[log[0].mood]
  const last = MOOD_INDEX[log[log.length - 1].mood]
  const diff = last - first
  if (diff >= 2) return '心がだいぶ軽くなった'
  if (diff === 1) return '少し軽くなった'
  if (diff <= -2) return '疲れてる。休んでいい。'
  if (diff === -1) return '少し重くなったかも'
  return null
}

export function MoodPicker() {
  const { moodLog, dailyNotes, addMood, setDailyNotes } = useDay()
  const shift = shiftMessage(moodLog)

  return (
    <div className="px-1">
      <p className="text-xs text-wabi-text-muted mb-2">今の気持ち</p>

      {/* ボタン行 — タップで記録 */}
      <div className="flex gap-1">
        {MOOD_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => addMood(value)}
            className="flex-1 py-2 text-xs rounded-lg cursor-pointer transition-colors text-wabi-text-muted hover:bg-wabi-surface hover:text-wabi-text active:bg-wabi-accent/20"
          >
            {label}
          </button>
        ))}
      </div>

      {/* タイムライン */}
      {moodLog.length > 0 && (
        <div className="mt-3 flex items-center gap-1 flex-wrap">
          {moodLog.map((entry, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 text-[10px] text-wabi-text-muted bg-wabi-surface px-1.5 py-0.5 rounded"
            >
              <span className="font-mono opacity-50">{entry.time}</span>
              <span>{MOOD_LABEL[entry.mood]}</span>
            </span>
          ))}
        </div>
      )}

      {/* 変化メッセージ */}
      {shift && (
        <p className="text-[10px] text-wabi-check mt-1.5">{shift}</p>
      )}

      {/* 心のメモ */}
      <textarea
        value={dailyNotes}
        onChange={e => setDailyNotes(e.target.value)}
        placeholder="心のメモ"
        rows={1}
        className="w-full mt-3 bg-transparent text-sm text-wabi-text placeholder:text-wabi-text-muted/40 border border-wabi-border/50 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-wabi-accent/50"
      />
    </div>
  )
}
