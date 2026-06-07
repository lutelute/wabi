import { storage } from '../storage'
import { wabiRecentDates, weekdayLabel } from './wabiDate'
import type { DayState } from '../contexts/DayContext'
import type { DailyActionState, Mood } from '../types/routine'

const MOOD_LABEL: Record<Mood, string> = {
  heavy: '重い', cloudy: 'もやもや', flat: 'ふつう', calm: '穏やか', light: '軽い',
}

/** 1日分の記録（day: チェックイン等 / actions: アクションリスト） */
export interface DayRecord {
  date: string
  day: DayState | null
  actions: DailyActionState | null
}

/** 直近N日分（今日を含む）の記録を読み込む。古い順。 */
export async function loadRecentDays(n: number): Promise<DayRecord[]> {
  const dates = wabiRecentDates(n)
  return Promise.all(
    dates.map(async date => ({
      date,
      day: await storage.getDayState(`day:${date}`),
      actions: await storage.getActionState(date),
    })),
  )
}

export type AxisKey = 'stamina' | 'mental' | 'wave' | 'bodyTemp'

/** 日ごとの軸平均（チェックインなしの日は null） */
export function axisSeries(records: DayRecord[], axis: AxisKey): (number | null)[] {
  return records.map(r => {
    const values = (r.day?.checkIns ?? [])
      .map(ci => ci[axis])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    if (values.length === 0) return null
    return values.reduce((s, v) => s + v, 0) / values.length
  })
}

/** 日ごとのほどき（完了）状況 */
export function completionSeries(records: DayRecord[]): { date: string; done: number; total: number }[] {
  return records.map(r => {
    const actions = r.actions?.actions ?? []
    const checked = r.actions?.checkedItems ?? {}
    return {
      date: r.date,
      done: actions.filter(a => checked[a.id]).length,
      total: actions.length,
    }
  })
}

/** 期間中のタグ頻度（多い順） */
export function tagFrequency(records: DayRecord[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const r of records) {
    for (const ci of r.day?.checkIns ?? []) {
      for (const t of ci.tags) counts.set(t, (counts.get(t) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

/** 手放したもの（declined）の一覧 */
export function declinedList(records: DayRecord[]): { date: string; text: string }[] {
  return records
    .filter(r => r.actions?.declined?.trim())
    .map(r => ({ date: r.date, text: r.actions!.declined.trim() }))
}

/** 日ごとの優勢ムード */
export function moodByDay(records: DayRecord[]): { date: string; mood: Mood | null }[] {
  return records.map(r => {
    const log = r.day?.moodLog ?? []
    if (log.length === 0) return { date: r.date, mood: null }
    const counts: Record<string, number> = {}
    for (const e of log) counts[e.mood] = (counts[e.mood] || 0) + 1
    let best: Mood | null = null
    let max = 0
    for (const [mood, count] of Object.entries(counts)) {
      if (count > max) { max = count; best = mood as Mood }
    }
    return { date: r.date, mood: best }
  })
}

/** 記録のある日数 */
export function activeDayCount(records: DayRecord[]): number {
  return records.filter(r =>
    (r.day?.checkIns?.length ?? 0) > 0 ||
    (r.day?.moodLog?.length ?? 0) > 0 ||
    (r.actions?.actions?.length ?? 0) > 0
  ).length
}

/** "MM/DD" 表示 */
export function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

/** AI振り返り相談用の全文テキストを組み立てる */
export function buildWeeklyAiText(records: DayRecord[]): string {
  const lines: string[] = []
  lines.push('以下は、私の最近7日間の記録です（wabi: ルーティンとセルフチェックのアプリから書き出しました）。')
  lines.push('数値はすべて0〜100。体温=冷↔熱 / 体力=高いほど残っている / 淀=濁↔澄 / 波=凪↔荒。')
  lines.push('「ほどき」はその日のタスクを終えた数です。')
  lines.push('')
  lines.push('お願い: 採点や叱責はせず、穏やかなトーンで次の3つだけ教えてください。')
  lines.push('1. 見えるパターン（体と心のつながり）')
  lines.push('2. 良かった兆し')
  lines.push('3. 次の7日への小さな提案（休息の取り方を含めて）')
  lines.push('')
  lines.push('---')

  for (const r of records) {
    lines.push('')
    lines.push(`## ${r.date} (${weekdayLabel(r.date)})`)

    const checkIns = r.day?.checkIns ?? []
    if (checkIns.length > 0) {
      for (const ci of checkIns) {
        let line = `- ${ci.time} 体温:${ci.bodyTemp ?? '-'} 体力:${ci.stamina} 淀:${ci.mental} 波:${ci.wave ?? '-'}`
        if (ci.tags.length > 0) line += ` ${ci.tags.map(t => `#${t}`).join(' ')}`
        if (ci.comment) line += ` 「${ci.comment}」`
        lines.push(line)
      }
    }

    const moodLog = r.day?.moodLog ?? []
    if (moodLog.length > 0) {
      lines.push(`気分: ${moodLog.map(e => `${e.time} ${MOOD_LABEL[e.mood]}`).join(' → ')}`)
    }

    const actions = r.actions?.actions ?? []
    if (actions.length > 0) {
      const checked = r.actions!.checkedItems ?? {}
      const done = actions.filter(a => checked[a.id]).length
      lines.push(`ほどき: ${done}/${actions.length}`)
      const undone = actions.filter(a => !checked[a.id]).map(a => a.title)
      if (undone.length > 0 && undone.length <= 5) {
        lines.push(`残したもの: ${undone.join('、')}`)
      }
    }

    if (r.day?.restTaken) {
      lines.push('休息: あり')
    }

    const declined = r.actions?.declined?.trim()
    if (declined) {
      lines.push(`手放した: ${declined}`)
    }

    const notes = r.day?.dailyNotes?.trim()
    if (notes) {
      lines.push(`心のメモ: ${notes}`)
    }

    if (checkIns.length === 0 && moodLog.length === 0 && actions.length === 0) {
      lines.push('（記録なし）')
    }
  }

  return lines.join('\n')
}
