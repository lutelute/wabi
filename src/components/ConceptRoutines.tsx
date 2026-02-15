import { useState, useEffect, useMemo } from 'react'
import { useExecution } from '../contexts/ExecutionContext'
import { useDay } from '../contexts/DayContext'
import { useSettings } from '../contexts/SettingsContext'
import type { TimeSlot } from '../types/routine'

function getCurrentSlot(): TimeSlot {
  const h = new Date().getHours()
  if (h < 7) return 'morning'
  if (h < 10) return 'forenoon'
  if (h < 13) return 'noon'
  if (h < 16) return 'afternoon'
  if (h < 19) return 'evening'
  return 'night'
}

const SLOT_LABELS: Record<TimeSlot, string> = {
  morning: '朝',
  forenoon: '午前',
  noon: '昼',
  afternoon: '午後',
  evening: '夕方',
  night: '夜',
}

interface Template {
  id: string
  slot: TimeSlot
  message: string
}

const TEMPLATES: Template[] = [
  { id: 'morning-1', slot: 'morning', message: '今日、自分が大切にしたいことをひとつ思い浮かべる' },
  { id: 'morning-2', slot: 'morning', message: '窓を開けて、外の空気を吸う' },
  { id: 'forenoon-1', slot: 'forenoon', message: '本当に取り組みたいことに手を付ける' },
  { id: 'forenoon-2', slot: 'forenoon', message: '今の体調を感じてみる' },
  { id: 'noon-1', slot: 'noon', message: 'ゆっくり食べる。味わう。' },
  { id: 'noon-2', slot: 'noon', message: '午前の自分に「おつかれさま」と言う' },
  { id: 'afternoon-1', slot: 'afternoon', message: '少し歩いてみる' },
  { id: 'afternoon-2', slot: 'afternoon', message: '残りの時間でやることをひとつに絞る' },
  { id: 'evening-1', slot: 'evening', message: '今日できたことを思い出す' },
  { id: 'evening-2', slot: 'evening', message: '手放していいものを手放す' },
  { id: 'night-1', slot: 'night', message: '明日のことは明日の自分に任せる' },
  { id: 'night-2', slot: 'night', message: '心地よいと思えることをする' },
]

export function ConceptRoutines() {
  const { settings } = useSettings()
  const { dismissedConcepts, dismissConcept } = useExecution()
  const { customConcepts, addCustomConcept } = useDay()
  const [slot, setSlot] = useState(getCurrentSlot)
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      const newSlot = getCurrentSlot()
      if (newSlot !== slot) setSlot(newSlot)
    }, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [slot])

  const suggestions = useMemo(() => {
    return TEMPLATES
      .filter(t => t.slot === slot && !dismissedConcepts.includes(t.id))
  }, [slot, dismissedConcepts])

  if (!settings.conceptRoutinesEnabled) return null

  const handleAdd = () => {
    if (newText.trim()) {
      addCustomConcept(newText.trim())
      setNewText('')
      setAdding(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-wabi-text-muted/50">{SLOT_LABELS[slot]}のひとこと</p>
        <button
          onClick={() => setAdding(true)}
          className="text-wabi-text-muted hover:text-wabi-text text-sm leading-none cursor-pointer"
          title="カスタム追加"
        >
          +
        </button>
      </div>

      {suggestions.map(s => (
        <div
          key={s.id}
          className="flex items-start gap-1.5 bg-wabi-bg/50 rounded px-2 py-1.5 border border-wabi-border/20"
        >
          <p className="flex-1 text-[10px] text-wabi-text-muted italic leading-relaxed">{s.message}</p>
          <button
            onClick={() => dismissConcept(s.id)}
            className="shrink-0 text-[10px] text-wabi-text-muted/30 hover:text-wabi-text-muted cursor-pointer"
            title="dismiss"
          >
            ×
          </button>
        </div>
      ))}

      {customConcepts.map((text, i) => (
        <div
          key={`custom-${i}`}
          className="flex items-start gap-1.5 bg-wabi-accent/5 rounded px-2 py-1.5 border border-wabi-accent/20"
        >
          <p className="flex-1 text-[10px] text-wabi-text-muted italic leading-relaxed">{text}</p>
        </div>
      ))}

      {adding && (
        <div className="pt-1">
          <input
            autoFocus
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAdd()
              if (e.key === 'Escape') { setAdding(false); setNewText('') }
            }}
            onBlur={() => { if (!newText.trim()) setAdding(false) }}
            placeholder="自分へのひとこと"
            className="w-full bg-wabi-bg border border-wabi-border rounded px-2 py-1 text-[10px] outline-none focus:border-wabi-accent"
          />
        </div>
      )}
    </div>
  )
}
