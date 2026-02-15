import { useState, useEffect, useMemo } from 'react'
import { storage } from '../storage'
import { useRoutines } from '../contexts/RoutineContext'
import type { CalendarDayData, Mood, ExecutionState } from '../types/routine'
import type { DayState } from '../contexts/DayContext'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

const MOOD_COLORS: Record<Mood, string> = {
  heavy: '#94a3b8',
  cloudy: '#a1a1aa',
  flat: '#d4d4d8',
  calm: '#86efac',
  light: '#fde68a',
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

export function MonthlyCalendar({ compact = false }: { compact?: boolean } = {}) {
  const { selected } = useRoutines()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [dayDataMap, setDayDataMap] = useState<Record<string, CalendarDayData>>({})
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedDayDetail, setSelectedDayDetail] = useState<{ exec: ExecutionState | null; day: DayState | null } | null>(null)

  const todayStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  // 月データ読み込み
  useEffect(() => {
    const loadMonth = async () => {
      const days = daysInMonth(year, month)
      const map: Record<string, CalendarDayData> = {}

      for (let d = 1; d <= days; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const dayKey = `day:${dateStr}`
        const dayState = await storage.getDayState(dayKey)

        let execState: ExecutionState | null = null
        if (selected) {
          const execKey = `${selected.id}:${dateStr}`
          execState = await storage.getExecution(execKey)
        }

        const hasData = !!(dayState || execState)
        const checkInCount = dayState?.checkIns?.length ?? 0

        // dominant mood
        let dominantMood: Mood | null = null
        if (dayState?.moodLog && dayState.moodLog.length > 0) {
          const counts: Record<string, number> = {}
          for (const entry of dayState.moodLog) {
            counts[entry.mood] = (counts[entry.mood] || 0) + 1
          }
          let maxCount = 0
          for (const [mood, count] of Object.entries(counts)) {
            if (count > maxCount) {
              maxCount = count
              dominantMood = mood as Mood
            }
          }
        }

        // completion ratio
        let completionRatio = 0
        if (execState && selected) {
          const totalItems = selected.phases.flatMap(p => p.items).length
          const checkedCount = Object.values(execState.checkedItems).filter(Boolean).length
          completionRatio = totalItems > 0 ? checkedCount / totalItems : 0
        }

        map[dateStr] = { date: dateStr, checkInCount, dominantMood, completionRatio, hasData }
      }

      setDayDataMap(map)
    }

    loadMonth()
  }, [year, month, selected?.id])

  // 日選択時の詳細読み込み
  useEffect(() => {
    if (!selectedDay) {
      setSelectedDayDetail(null)
      return
    }
    const load = async () => {
      const dayKey = `day:${selectedDay}`
      const dayState = await storage.getDayState(dayKey)
      let execState: ExecutionState | null = null
      if (selected) {
        const execKey = `${selected.id}:${selectedDay}`
        execState = await storage.getExecution(execKey)
      }
      setSelectedDayDetail({ exec: execState, day: dayState })
    }
    load()
  }, [selectedDay, selected?.id])

  const days = daysInMonth(year, month)
  const offset = firstDayOfWeek(year, month)
  const cells: (number | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  return (
    <div className={compact ? '' : 'px-1'}>
      {/* ヘッダー */}
      <div className={`flex items-center justify-between ${compact ? 'mb-1.5' : 'mb-3'}`}>
        <button onClick={prevMonth} className="text-xs text-wabi-text-muted hover:text-wabi-text cursor-pointer px-1">←</button>
        <span className={`text-wabi-text-muted ${compact ? 'text-[10px]' : 'text-xs'}`}>
          {compact ? `${month + 1}月` : `${year}年${month + 1}月`}
        </span>
        <button onClick={nextMonth} className="text-xs text-wabi-text-muted hover:text-wabi-text cursor-pointer px-1">→</button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {WEEKDAY_LABELS.map(w => (
          <div key={w} className={`text-center text-wabi-text-muted/40 ${compact ? 'text-[8px]' : 'text-[9px]'}`}>{w}</div>
        ))}
      </div>

      {/* 日セル */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const data = dayDataMap[dateStr]
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDay

          // 緑の濃淡 (完了率)
          const greenAlpha = data?.completionRatio ? Math.round(data.completionRatio * 40) : 0

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDay(prev => prev === dateStr ? null : dateStr)}
              className={`relative aspect-square flex flex-col items-center justify-center rounded cursor-pointer transition-colors ${
                isSelected ? 'bg-wabi-accent/20 border border-wabi-accent/40' : 'hover:bg-wabi-surface/50'
              } ${isToday ? 'font-bold' : ''}`}
              style={greenAlpha > 0 ? { backgroundColor: `rgba(34,197,94,${greenAlpha / 100})` } : undefined}
            >
              <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} ${data?.hasData ? 'text-wabi-text' : 'text-wabi-text-muted/40'}`}>
                {day}
              </span>
              {/* ドット: checkIn数 (compact時は非表示) */}
              {!compact && data && data.checkInCount > 0 && (
                <div className="flex gap-px mt-0.5">
                  {Array.from({ length: Math.min(data.checkInCount, 3) }).map((_, di) => (
                    <div key={di} className="w-1 h-1 rounded-full bg-sky-400/60" />
                  ))}
                </div>
              )}
              {/* ムードリング */}
              {data?.dominantMood && (
                <div
                  className="absolute inset-0.5 rounded-sm border-2 pointer-events-none"
                  style={{ borderColor: MOOD_COLORS[data.dominantMood] + '40' }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* 日詳細ポップオーバー */}
      {selectedDay && selectedDayDetail && (
        <DayPopover
          date={selectedDay}
          detail={selectedDayDetail}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}

function DayPopover({ date, detail, onClose }: {
  date: string
  detail: { exec: ExecutionState | null; day: DayState | null }
  onClose: () => void
}) {
  const { exec, day } = detail
  const hasAny = !!(exec || day)

  if (!hasAny) {
    return (
      <div className="mt-2 bg-wabi-surface rounded-lg border border-wabi-border/40 p-3 text-xs text-wabi-text-muted">
        <div className="flex justify-between">
          <span className="font-mono">{date}</span>
          <button onClick={onClose} className="text-wabi-text-muted/40 hover:text-wabi-text-muted cursor-pointer">×</button>
        </div>
        <p className="mt-1 opacity-50">データなし</p>
      </div>
    )
  }

  const checkedCount = exec ? Object.values(exec.checkedItems).filter(Boolean).length : 0
  const checkInCount = day?.checkIns?.length ?? 0

  return (
    <div className="mt-2 bg-wabi-surface rounded-lg border border-wabi-border/40 p-3 text-xs space-y-1.5">
      <div className="flex justify-between">
        <span className="font-mono text-wabi-text-muted">{date}</span>
        <button onClick={onClose} className="text-wabi-text-muted/40 hover:text-wabi-text-muted cursor-pointer">×</button>
      </div>
      {checkedCount > 0 && (
        <p className="text-wabi-text-muted">完了: {checkedCount}項目</p>
      )}
      {checkInCount > 0 && (
        <p className="text-wabi-text-muted">チェックイン: {checkInCount}回</p>
      )}
      {day?.moodLog && day.moodLog.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {day.moodLog.map((e, i) => (
            <span key={i} className="text-[10px] bg-wabi-bg px-1 py-0.5 rounded text-wabi-text-muted">
              {e.mood}
            </span>
          ))}
        </div>
      )}
      {exec?.declined && (
        <p className="text-[10px] text-wabi-text-muted/50">手放したこと: {exec.declined}</p>
      )}
    </div>
  )
}
