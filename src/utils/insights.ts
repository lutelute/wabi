import type { DayRecord } from './weeklyData'

/**
 * 気づきの種。
 *
 * 過去の記録から、ささやかな相関をひとつだけ拾って言葉にする。
 * - 断定しない（「〜のようです」）
 * - 責めない（低い数値を悪と呼ばない）
 * - データが薄いときは黙る（null）
 */

interface DaySummary {
  stamina: number | null
  mental: number | null
  wave: number | null
  bodyTemp: number | null
  completion: number | null   // 0-1（アクションなしの日は null）
  rest: boolean
  hasCheckIn: boolean
}

function summarize(records: DayRecord[]): DaySummary[] {
  return records.map(r => {
    const cis = r.day?.checkIns ?? []
    const avg = (pick: (ci: (typeof cis)[number]) => number | undefined): number | null => {
      const vals = cis.map(pick).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null
    }
    const actions = r.actions?.actions ?? []
    const checked = r.actions?.checkedItems ?? {}
    return {
      stamina: avg(ci => ci.stamina),
      mental: avg(ci => ci.mental),
      wave: avg(ci => ci.wave),
      bodyTemp: avg(ci => ci.bodyTemp),
      completion: actions.length > 0 ? actions.filter(a => checked[a.id]).length / actions.length : null,
      rest: r.day?.restTaken ?? false,
      hasCheckIn: cis.length > 0,
    }
  })
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length
}

/** 過去の記録からひとつだけ気づきを返す。見つからなければ null。 */
export function findInsight(records: DayRecord[]): string | null {
  const days = summarize(records)

  // チェックインのある日が5日未満なら、まだ何も言わない
  if (days.filter(d => d.hasCheckIn).length < 5) return null

  // 1. 休息と淀: 休息をとった日は心が澄みやすい？
  {
    const restDays = days.filter(d => d.rest && d.mental != null)
    const otherDays = days.filter(d => !d.rest && d.hasCheckIn && d.mental != null)
    if (restDays.length >= 2 && otherDays.length >= 2) {
      const diff = mean(restDays.map(d => d.mental!)) - mean(otherDays.map(d => d.mental!))
      if (diff >= 10) return '休息をとった日は、心が澄みやすいようです'
    }
  }

  // 2. 波とほどき: 波が高い日はほどきが少なめ？
  {
    const waveDays = days.filter(d => d.wave != null && d.completion != null)
    const high = waveDays.filter(d => d.wave! >= 55)
    const low = waveDays.filter(d => d.wave! < 45)
    if (high.length >= 2 && low.length >= 2) {
      const diff = mean(low.map(d => d.completion!)) - mean(high.map(d => d.completion!))
      if (diff >= 0.2) return '波が高い日は、ほどきが少なめのようです。そういう日があっていい'
    }
  }

  // 3. 体温と体力: 体温の低い日は体力も控えめ？
  {
    const tempDays = days.filter(d => d.bodyTemp != null && d.stamina != null)
    const cold = tempDays.filter(d => d.bodyTemp! < 45)
    const warm = tempDays.filter(d => d.bodyTemp! >= 55)
    if (cold.length >= 2 && warm.length >= 2) {
      const diff = mean(warm.map(d => d.stamina!)) - mean(cold.map(d => d.stamina!))
      if (diff >= 12) return '体温が低めの日は、体力も静かなようです。あたためることから'
    }
  }

  // 4. ほどきと心: よくほどけた日は心も澄む？（順方向の発見だけ言う）
  {
    const compDays = days.filter(d => d.completion != null && d.mental != null)
    const more = compDays.filter(d => d.completion! >= 0.7)
    const less = compDays.filter(d => d.completion! < 0.5)
    if (more.length >= 2 && less.length >= 2) {
      const diff = mean(more.map(d => d.mental!)) - mean(less.map(d => d.mental!))
      if (diff >= 10) return 'よくほどけた日は、心も澄んでいるようです'
    }
  }

  // 5. 休息が一度もない週へのささやかな声かけ
  {
    const activeDays = days.filter(d => d.hasCheckIn)
    if (activeDays.length >= 6 && !days.some(d => d.rest)) {
      return 'この7日、休息の記録がありません。小さく休む日があってもいい'
    }
  }

  return null
}
