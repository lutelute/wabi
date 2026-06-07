import type { DayState } from '../contexts/DayContext'
import type { DailyAction, MentalCompletion, Mood, DailyNoteMeta } from '../types/routine'

const MOOD_LABEL: Record<Mood, string> = {
  heavy: '重い', cloudy: 'もやもや', flat: 'ふつう', calm: '穏やか', light: '軽い',
}

function dominantMood(moods: Mood[]): Mood | null {
  if (moods.length === 0) return null
  const counts: Record<string, number> = {}
  for (const m of moods) counts[m] = (counts[m] || 0) + 1
  let best: Mood | null = null
  let max = 0
  for (const [mood, count] of Object.entries(counts)) {
    if (count > max) { max = count; best = mood as Mood }
  }
  return best
}

/** 今日のアクションリストの実行状況 */
export interface DailyActionSnapshot {
  actions: DailyAction[]
  checkedItems: Record<string, boolean>
  itemMoods: Record<string, Mood>
  itemComments: Record<string, string>
  mentalCompletions: MentalCompletion[]
  declined: string
}

export function buildDailyNoteMeta(
  dayState: DayState,
  snapshot: DailyActionSnapshot,
): DailyNoteMeta {
  const checkedCount = snapshot.actions.filter(a => snapshot.checkedItems[a.id]).length
  const totalCount = snapshot.actions.length

  const allTags = dayState.checkIns.flatMap(ci => ci.tags)
  const uniqueTags = [...new Set(allTags)]

  return {
    date: dayState.date,
    stamina: dayState.staminaLog.map(e => e.level),
    mental: dayState.mentalLog.map(e => e.level),
    mood_flow: dayState.moodLog.map(e => e.mood),
    dominant_mood: dominantMood(dayState.moodLog.map(e => e.mood)),
    completion: `${checkedCount}/${totalCount}`,
    completion_ratio: totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) / 100 : 0,
    check_in_count: dayState.checkIns.length,
    tags: uniqueTags,
  }
}

function yamlArray(arr: (string | number)[]): string {
  if (arr.length === 0) return '[]'
  return '[' + arr.map(v => typeof v === 'string' ? v : String(v)).join(', ') + ']'
}

export function metaToYaml(meta: DailyNoteMeta, dayState: DayState): string {
  const lines: string[] = []
  lines.push('---')
  lines.push(`date: ${meta.date}`)
  lines.push(`stamina: ${yamlArray(meta.stamina)}`)
  lines.push(`mental: ${yamlArray(meta.mental)}`)
  if (dayState.waveLog.length > 0) {
    lines.push(`wave: ${yamlArray(dayState.waveLog.map(e => e.level))}`)
  }
  if (dayState.bodyTempLog.length > 0) {
    lines.push(`body_temp: ${yamlArray(dayState.bodyTempLog.map(e => e.level))}`)
  }
  lines.push(`mood_flow: ${yamlArray(meta.mood_flow)}`)
  lines.push(`dominant_mood: ${meta.dominant_mood ?? 'null'}`)
  lines.push(`completion: "${meta.completion}"`)
  lines.push(`completion_ratio: ${meta.completion_ratio}`)
  lines.push(`check_in_count: ${meta.check_in_count}`)
  lines.push(`tags: ${yamlArray(meta.tags)}`)
  lines.push('---')
  return lines.join('\n')
}

export function buildDailyNoteMarkdown(
  dayState: DayState,
  snapshot: DailyActionSnapshot,
): string {
  const meta = buildDailyNoteMeta(dayState, snapshot)
  const sections: string[] = []

  // YAML frontmatter
  sections.push(metaToYaml(meta, dayState))

  // Check-ins（4軸）
  if (dayState.checkIns.length > 0) {
    sections.push('')
    sections.push('## チェックイン')
    for (const ci of dayState.checkIns) {
      const tagStr = ci.tags.length > 0 ? ' ' + ci.tags.map(t => `#${t}`).join(' ') : ''
      let line = `- ${ci.time} 体温:${ci.bodyTemp ?? '-'} 体力:${ci.stamina} 淀:${ci.mental} 波:${ci.wave ?? '-'}${tagStr}`
      if (ci.comment) line += ` ${ci.comment}`
      sections.push(line)
    }
  }

  // Mood flow
  if (dayState.moodLog.length > 0) {
    sections.push('')
    sections.push('## 気分の流れ')
    const flow = dayState.moodLog.map(e => `${e.time} ${MOOD_LABEL[e.mood]}`).join(' → ')
    sections.push(flow)
  }

  // 今日のアクション（出どころのルーティンごとにまとめる）
  if (snapshot.actions.length > 0) {
    sections.push('')
    sections.push('## 今日のアクション')
    const byRoutine = new Map<string, DailyAction[]>()
    for (const a of snapshot.actions) {
      const key = a.sourceRoutineName || ''
      if (!byRoutine.has(key)) byRoutine.set(key, [])
      byRoutine.get(key)!.push(a)
    }
    for (const [routineName, actions] of byRoutine) {
      if (routineName && byRoutine.size > 1) sections.push(`### ${routineName}`)
      for (const a of actions) {
        const checked = snapshot.checkedItems[a.id]
        const mark = checked ? 'x' : ' '
        const mood = snapshot.itemMoods[a.id]
        const moodSuffix = mood ? ` (${MOOD_LABEL[mood]})` : ''
        const mentalTag = a.isMental ? ' @mental' : ''
        sections.push(`- [${mark}] ${a.title}${mentalTag}${moodSuffix}`)

        // ひとことメモ
        const comment = snapshot.itemComments[a.id]
        if (comment) sections.push(`  > ${comment}`)

        // @mental の振り返り
        const mc = snapshot.mentalCompletions.find(m => m.itemId === a.id)
        if (mc) sections.push(`  > ${mc.reflection}`)
      }
    }
  }

  // Notes section
  const hasNotes = dayState.dailyNotes || snapshot.declined
  if (hasNotes) {
    sections.push('')
    sections.push('## ノート')
    if (snapshot.declined) {
      sections.push(`手放したこと: ${snapshot.declined}`)
    }
    if (dayState.dailyNotes) {
      sections.push(dayState.dailyNotes)
    }
  }

  return sections.join('\n') + '\n'
}
