import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { nanoid } from 'nanoid'
import { storage } from '../storage'
import { useRoutines } from './RoutineContext'
import type { Reminder, ReminderInstance } from '../types/routine'

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function nowHHMM(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

interface ReminderContextValue {
  reminders: Reminder[]
  pendingReminders: Reminder[]
  addReminder: (subject: string, time: string, body?: string) => void
  updateReminder: (id: string, updates: Partial<Reminder>) => void
  deleteReminder: (id: string) => void
  dismissReminder: (reminderId: string) => void
  snoozeReminder: (reminderId: string, minutes: number) => void
}

const ReminderContext = createContext<ReminderContextValue | null>(null)

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { selected } = useRoutines()
  const [reminders, setReminders] = useState<Reminder[]>(() => storage.getReminders())
  const [instances, setInstances] = useState<ReminderInstance[]>(() => storage.getReminderState(todayString()))
  const [now, setNow] = useState(nowHHMM)

  // 60秒ポーリング
  useEffect(() => {
    const interval = setInterval(() => setNow(nowHHMM()), 60_000)
    return () => clearInterval(interval)
  }, [])

  // ルーティンのtimeフィールドからの自動リマインダー同期
  useEffect(() => {
    if (!selected) return
    const routineReminders: Reminder[] = []
    for (const phase of selected.phases) {
      for (const item of phase.items) {
        if (item.time) {
          routineReminders.push({
            id: `routine:${item.id}`,
            subject: item.title,
            time: item.time,
            sourceType: 'routine',
            sourceItemId: item.id,
            recurring: true,
            enabled: true,
          })
        }
      }
    }
    setReminders(prev => {
      const manual = prev.filter(r => r.sourceType === 'manual')
      const merged = [...manual, ...routineReminders]
      storage.saveReminders(merged)
      return merged
    })
  }, [selected?.id, selected?.phases])

  // 保存
  useEffect(() => {
    storage.saveReminders(reminders)
  }, [reminders])

  useEffect(() => {
    storage.saveReminderState(todayString(), instances)
  }, [instances])

  const pendingReminders = useMemo(() => {
    return reminders.filter(r => {
      if (!r.enabled) return false
      if (r.time > now) return false
      // 既にdismissedか？
      const inst = instances.find(i => i.reminderId === r.id)
      if (inst?.dismissed) return false
      return true
    })
  }, [reminders, now, instances])

  // pending通知（新しくpendingになったら通知）
  useEffect(() => {
    for (const r of pendingReminders) {
      const inst = instances.find(i => i.reminderId === r.id)
      if (!inst?.fired) {
        storage.showNotification('wabi', r.subject)
        setInstances(prev => {
          const existing = prev.find(i => i.reminderId === r.id)
          if (existing) {
            return prev.map(i => i.reminderId === r.id ? { ...i, fired: true } : i)
          }
          return [...prev, { reminderId: r.id, date: todayString(), fired: true, dismissed: false }]
        })
      }
    }
  }, [pendingReminders, instances])

  const addReminder = useCallback((subject: string, time: string, body?: string) => {
    const reminder: Reminder = {
      id: nanoid(8),
      subject,
      body,
      time,
      sourceType: 'manual',
      recurring: false,
      enabled: true,
    }
    setReminders(prev => [...prev, reminder])
  }, [])

  const updateReminder = useCallback((id: string, updates: Partial<Reminder>) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }, [])

  const deleteReminder = useCallback((id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id))
  }, [])

  const dismissReminder = useCallback((reminderId: string) => {
    setInstances(prev => {
      const existing = prev.find(i => i.reminderId === reminderId)
      if (existing) {
        return prev.map(i => i.reminderId === reminderId ? { ...i, dismissed: true } : i)
      }
      return [...prev, { reminderId, date: todayString(), fired: true, dismissed: true }]
    })
  }, [])

  const snoozeReminder = useCallback((reminderId: string, minutes: number) => {
    // スヌーズ: 時間を未来にずらす
    const [h, m] = nowHHMM().split(':').map(Number)
    const total = h * 60 + m + minutes
    const nh = Math.floor(total / 60) % 24
    const nm = total % 60
    const newTime = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
    // instanceをリセットして新しい時刻に
    setInstances(prev => prev.filter(i => i.reminderId !== reminderId))
    setReminders(prev => prev.map(r => r.id === reminderId ? { ...r, time: newTime } : r))
  }, [])

  return (
    <ReminderContext.Provider value={{
      reminders, pendingReminders,
      addReminder, updateReminder, deleteReminder, dismissReminder, snoozeReminder,
    }}>
      {children}
    </ReminderContext.Provider>
  )
}

export function useReminders() {
  const ctx = useContext(ReminderContext)
  if (!ctx) throw new Error('useReminders must be used within ReminderProvider')
  return ctx
}
