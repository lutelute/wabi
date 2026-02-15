import type { DayState } from '../contexts/DayContext'
import type { ExecutionState, Routine, Mood, DailyNoteMeta } from '../types/routine'

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

export function buildDailyNoteMeta(
  dayState: DayState,
  execState: ExecutionState | null,
  routine: Routine | null,
): DailyNoteMeta {
  const allItems = routine?.phases.flatMap(p => p.items) ?? []
  const checkedCount = execState
    ? Object.values(execState.checkedItems).filter(Boolean).length
    : 0
  const totalCount = allItems.length

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

export function metaToYaml(meta: DailyNoteMeta): string {
  const lines: string[] = []
  lines.push('---')
  lines.push(`date: ${meta.date}`)
  lines.push(`stamina: ${yamlArray(meta.stamina)}`)
  lines.push(`mental: ${yamlArray(meta.mental)}`)
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
  execState: ExecutionState | null,
  routine: Routine | null,
): string {
  const meta = buildDailyNoteMeta(dayState, execState, routine)
  const sections: string[] = []

  // YAML frontmatter
  sections.push(metaToYaml(meta))

  // Check-ins
  if (dayState.checkIns.length > 0) {
    sections.push('')
    sections.push('## チェックイン')
    for (const ci of dayState.checkIns) {
      const tagStr = ci.tags.length > 0 ? ' ' + ci.tags.map(t => `#${t}`).join(' ') : ''
      let line = `- ${ci.time} 体力:${ci.stamina} 心:${ci.mental}${tagStr}`
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

  // Routine section
  if (routine && execState) {
    sections.push('')
    sections.push(`## ルーティン: ${routine.name}`)
    for (const phase of routine.phases) {
      sections.push(`### ${phase.title}`)
      for (const item of phase.items) {
        const checked = execState.checkedItems[item.id]
        const mark = checked ? 'x' : ' '
        const mood = execState.itemMoods[item.id] as Mood | undefined
        const moodSuffix = mood ? ` (${MOOD_LABEL[mood]})` : ''
        const mentalTag = item.isMental ? ' @mental' : ''
        sections.push(`- [${mark}] ${item.title}${mentalTag}${moodSuffix}`)

        // Mental completion reflection
        const mc = execState.mentalCompletions.find(m => m.itemId === item.id)
        if (mc) {
          sections.push(`  > ${mc.reflection}`)
        }
      }
    }
  }

  // Notes section
  const hasNotes = dayState.dailyNotes || execState?.declined
  if (hasNotes) {
    sections.push('')
    sections.push('## ノート')
    if (execState?.declined) {
      sections.push(`手放したこと: ${execState.declined}`)
    }
    if (dayState.dailyNotes) {
      sections.push(dayState.dailyNotes)
    }
  }

  return sections.join('\n') + '\n'
}
