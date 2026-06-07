/**
 * wabiの「一日」の定義。
 *
 * - 一日の境界は朝5時。5時より前は「まだ前日」として扱う（夜更かし対応）。
 * - 日付はすべてローカルタイムゾーン基準。
 *   旧実装は toISOString() によるUTC基準で、JSTでは朝9時まで前日扱いになっていた。
 */
export const DAY_BOUNDARY_HOUR = 5

/** Date → ローカル日付 "YYYY-MM-DD" */
export function localDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 境界シフト済みの「いま」。wabi日付計算の基準点。 */
function shiftedNow(): Date {
  return new Date(Date.now() - DAY_BOUNDARY_HOUR * 3600_000)
}

/** wabiの「今日」。朝5時前は前日の日付を返す。 */
export function wabiToday(): string {
  return localDateString(shiftedNow())
}

/** wabiの「今日」を含む週（月曜始まり）の日付一覧 */
export function wabiWeekDates(): string[] {
  const base = shiftedNow()
  const day = base.getDay()
  const monday = new Date(base)
  monday.setDate(base.getDate() - (day === 0 ? 6 : day - 1))
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(localDateString(d))
  }
  return dates
}

/** wabiの「今日」を含む月の日付一覧 */
export function wabiMonthDates(): string[] {
  const base = shiftedNow()
  const year = base.getFullYear()
  const month = base.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dates: string[] = []
  for (let i = 1; i <= daysInMonth; i++) {
    dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`)
  }
  return dates
}

/** 直近N日分（wabiの今日を含む）の日付一覧。古い順。 */
export function wabiRecentDates(n: number): string[] {
  const base = shiftedNow()
  const dates: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setDate(base.getDate() - i)
    dates.push(localDateString(d))
  }
  return dates
}

/** "YYYY-MM-DD" → 曜日ラベル（月火水...） */
export function weekdayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
}
