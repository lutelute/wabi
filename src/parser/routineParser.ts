import { nanoid } from 'nanoid'
import type { RoutineItem, RoutinePhase } from '../types/routine'

// パターン: - [HH:MM] タイトル [数字min/m/分/h] [@mental] [*N]
const LINE_REGEX = /^[-*]\s+(.*)$/
const TIME_REGEX = /^(\d{1,2}:\d{2})\s+/
const DURATION_REGEX = /\s+(\d+)\s*(min|m|分|h|時間)\s*$/i
const WEIGHT_REGEX = /\s+\*(\d+)\s*$/
const MENTAL_REGEX = /\s+@mental\s*$/i
const PHASE_REGEX = /^##\s+(.+)$/

export function parseLine(line: string): RoutineItem | null {
  const trimmed = line.trim()
  const lineMatch = trimmed.match(LINE_REGEX)
  if (!lineMatch) return null

  let content = lineMatch[1].trim()
  let time: string | null = null
  let duration: number | null = null
  let isMental = false

  // 時刻を抽出
  const timeMatch = content.match(TIME_REGEX)
  if (timeMatch) {
    time = timeMatch[1]
    content = content.slice(timeMatch[0].length)
  }

  // @mental を抽出（末尾）
  const mentalMatch = content.match(MENTAL_REGEX)
  if (mentalMatch) {
    isMental = true
    content = content.slice(0, -mentalMatch[0].length).trim()
  }

  // 重みを抽出 (*N 形式、末尾)
  let weight = 1
  const weightMatch = content.match(WEIGHT_REGEX)
  if (weightMatch) {
    weight = Math.max(1, Math.min(5, parseInt(weightMatch[1], 10)))
    content = content.slice(0, -weightMatch[0].length).trim()
  }

  // 所要時間を抽出
  const durationMatch = content.match(DURATION_REGEX)
  if (durationMatch) {
    const value = parseInt(durationMatch[1], 10)
    const unit = durationMatch[2].toLowerCase()
    duration = (unit === 'h' || unit === '時間') ? value * 60 : value
    content = content.slice(0, -durationMatch[0].length).trim()
  }

  const title = content.trim()
  if (!title) return null

  return {
    id: nanoid(8),
    time,
    title,
    duration,
    weight,
    isMental,
    rawLine: trimmed,
  }
}

export function parseRoutineText(text: string): RoutinePhase[] {
  const lines = text.split('\n')
  const phases: RoutinePhase[] = []
  let currentPhase: RoutinePhase | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    const phaseMatch = trimmed.match(PHASE_REGEX)

    if (phaseMatch) {
      // 新しいフェーズ開始
      currentPhase = {
        id: nanoid(8),
        title: phaseMatch[1].trim(),
        items: [],
      }
      phases.push(currentPhase)
      continue
    }

    const item = parseLine(line)
    if (item) {
      if (!currentPhase) {
        // フェーズなし → デフォルトフェーズに収容
        currentPhase = {
          id: nanoid(8),
          title: '',
          items: [],
        }
        phases.push(currentPhase)
      }
      currentPhase.items.push(item)
    }
  }

  return phases
}
