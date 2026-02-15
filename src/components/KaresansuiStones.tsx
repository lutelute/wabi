import { useRef, useEffect, useState } from 'react'
import { useActionList } from '../contexts/ActionListContext'
import { useSettings } from '../contexts/SettingsContext'
import { storage } from '../storage'

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function getWeekDates(): string[] {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function getMonthDates(): string[] {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dates: string[] = []
  for (let i = 1; i <= daysInMonth; i++) {
    dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`)
  }
  return dates
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

interface Particle {
  randomR: number
  randomAngle: number
  randomSpeed: number
  randomDrift: number
  targetRing: number
  targetAngle: number
  size: number
  brightness: number
}

function createParticles(count: number, rings: number, radius: number): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < count; i++) {
    const ring = i % rings
    const angleInRing = ((i / rings) | 0) / (count / rings) * Math.PI * 2
    particles.push({
      randomR: Math.random() * radius * 1.1,
      randomAngle: Math.random() * Math.PI * 2,
      randomSpeed: 0.0003 + Math.random() * 0.0008,
      randomDrift: 0.2 + Math.random() * 0.6,
      targetRing: ring,
      targetAngle: angleInRing + (Math.random() - 0.5) * 0.1,
      size: 0.6 + Math.random() * 1.4,
      brightness: 0.3 + Math.random() * 0.4,
    })
  }
  return particles
}

function drawGarden(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  ratio: number,
  label: string,
  dpr: number,
  time: number,
  particles: Particle[],
  rings: number,
) {
  const easedRatio = easeInOutCubic(Math.min(ratio, 1))

  const globalRotation = easedRatio > 0.95
    ? time * 0.00003
    : time * 0.00001 * easedRatio

  // ---- 砂紋（同心円）----
  for (let ring = 1; ring <= rings; ring++) {
    const baseR = (radius * ring) / (rings + 1)
    const points = 80 + ring * 12
    const distortion = (1 - easedRatio) * baseR * 0.4

    const breathe = easedRatio > 0.5
      ? Math.sin(time * 0.001 + ring * 0.5) * 2 * easedRatio
      : 0

    ctx.beginPath()
    for (let j = 0; j <= points; j++) {
      const angle = (j / points) * Math.PI * 2 + globalRotation

      const noise = distortion * (
        Math.sin(angle * 3 + ring * 1.7 + time * 0.0004) * 0.45 +
        Math.cos(angle * 5 + ring * 2.3 + time * 0.0003) * 0.3 +
        Math.sin(angle * 7 + ring * 0.9 + time * 0.0005) * 0.15 +
        Math.cos(angle * 11 + ring * 3.1) * 0.1
      )

      const r = baseR + noise + breathe
      const x = cx + Math.cos(angle) * r
      const y = cy + Math.sin(angle) * r

      if (j === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()

    const ringAlpha = (ring / rings)
    const alpha = lerp(0.08, 0.55, easedRatio) * ringAlpha

    const r = Math.round(lerp(196, 122, easedRatio * ringAlpha))
    const g = Math.round(lerp(168, 158, easedRatio * ringAlpha))
    const b = Math.round(lerp(130, 126, easedRatio * ringAlpha))

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
    ctx.lineWidth = lerp(0.4, 1.4, easedRatio) * dpr
    ctx.stroke()
  }

  // ---- パーティクル ----
  for (const p of particles) {
    const noiseAngle = p.randomAngle + time * p.randomSpeed
    const noiseDrift = Math.sin(time * p.randomSpeed * 1.3 + p.randomDrift * 10) * radius * 0.15
    const noiseR = p.randomR + noiseDrift
    const noiseX = cx + Math.cos(noiseAngle) * noiseR
    const noiseY = cy + Math.sin(noiseAngle) * noiseR

    const targetR = (radius * (p.targetRing + 1)) / (rings + 1)
    const targetAngle = p.targetAngle + globalRotation
    const targetX = cx + Math.cos(targetAngle) * targetR
    const targetY = cy + Math.sin(targetAngle) * targetR

    const x = lerp(noiseX, targetX, easedRatio)
    const y = lerp(noiseY, targetY, easedRatio)

    const size = p.size * dpr * lerp(0.8, 1.2, easedRatio)
    const alpha = lerp(p.brightness * 0.5, p.brightness * 1.2, easedRatio)

    ctx.beginPath()
    ctx.arc(x, y, size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(138, 132, 128, ${Math.min(alpha, 0.9)})`
    ctx.fill()
  }

  // ---- 中心の石 ----
  const stoneR = lerp(2, 7, easedRatio) * dpr
  const stoneBreathe = easedRatio > 0.8
    ? Math.sin(time * 0.0015) * 0.5 * dpr
    : 0
  const finalR = stoneR + stoneBreathe

  const gradient = ctx.createRadialGradient(
    cx - finalR * 0.3, cy - finalR * 0.3, 0,
    cx, cy, finalR
  )
  gradient.addColorStop(0, `rgba(80, 74, 68, ${lerp(0.2, 0.85, easedRatio)})`)
  gradient.addColorStop(0.7, `rgba(120, 114, 108, ${lerp(0.15, 0.6, easedRatio)})`)
  gradient.addColorStop(1, `rgba(160, 154, 148, ${lerp(0.05, 0.3, easedRatio)})`)
  ctx.beginPath()
  ctx.arc(cx, cy, finalR, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()

  // ---- ラベル ----
  ctx.fillStyle = `rgba(138, 132, 128, ${lerp(0.4, 0.7, easedRatio)})`
  ctx.font = `${11 * dpr}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(label, cx, cy + radius + 18 * dpr)

  // ---- 達成率 ----
  const pctText = `${Math.round(ratio * 100)}%`
  ctx.fillStyle = `rgba(138, 132, 128, ${lerp(0.2, 0.5, easedRatio)})`
  ctx.font = `${9 * dpr}px system-ui, sans-serif`
  ctx.fillText(pctText, cx, cy + radius + 30 * dpr)
}

function drawConnections(
  ctx: CanvasRenderingContext2D,
  gardens: { x: number; y: number; r: number }[],
  dpr: number,
  time: number,
) {
  for (let i = 0; i < gardens.length - 1; i++) {
    const a = gardens[i]
    const b = gardens[i + 1]

    const points = 30
    ctx.beginPath()
    for (let j = 0; j <= points; j++) {
      const t = j / points
      const x = lerp(a.x + a.r * 0.6, b.x - b.r * 0.6, t)
      const baseY = lerp(a.y, b.y, t)
      const wave = Math.sin(t * Math.PI * 3 + time * 0.0005) * 4 * dpr
      const y = baseY + wave * (1 - Math.abs(t - 0.5) * 2)

      if (j === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = 'rgba(196, 168, 130, 0.12)'
    ctx.lineWidth = 0.6 * dpr
    ctx.stroke()
  }
}

const SUB_RINGS = 7
const SUB_PARTICLES = 120

function getParticleCount(density: 'low' | 'normal' | 'high'): number {
  return density === 'low' ? 100 : density === 'high' ? 350 : 200
}

export function KaresansuiStones() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const { progress } = useActionList()
  const { settings } = useSettings()
  const [weekRatio, setWeekRatio] = useState(0)
  const [monthRatio, setMonthRatio] = useState(0)

  const dayRings = Number.isFinite(settings.karesansuiRings) ? settings.karesansuiRings : 10
  const dayParticleCount = getParticleCount(settings.particleCount)

  const dayParticlesRef = useRef<Particle[]>([])
  const weekParticlesRef = useRef<Particle[]>([])
  const monthParticlesRef = useRef<Particle[]>([])

  const dayRatio = (Number.isFinite(progress.capacity) && progress.capacity > 0 && Number.isFinite(progress.energy))
    ? Math.min(progress.energy / progress.capacity, 1)
    : 0

  // 週・月の履歴ロード
  useEffect(() => {
    async function loadHistory() {
      const today = todayString()
      const weekDates = getWeekDates()
      const monthDates = getMonthDates()

      let weekTotal = 0, weekDays = 0
      let monthTotal = 0, monthDays = 0

      const allDates = [...new Set([...weekDates, ...monthDates])]

      for (const date of allDates) {
        if (date > today) continue
        if (date === today) {
          const r = progress.capacity > 0 ? Math.min(progress.energy / progress.capacity, 1) : 0
          if (weekDates.includes(date)) { weekTotal += r; weekDays++ }
          if (monthDates.includes(date)) { monthTotal += r; monthDays++ }
          continue
        }

        // 新キーから読む
        const actionState = await storage.getActionState(date)
        if (actionState && actionState.actions.length > 0) {
          const checked = Object.values(actionState.checkedItems).filter(Boolean).length
          const total = actionState.actions.length
          const r = total > 0 ? checked / total : 0
          if (weekDates.includes(date)) { weekTotal += r; weekDays++ }
          if (monthDates.includes(date)) { monthTotal += r; monthDays++ }
          continue
        }

        // 旧キーからフォールバック: 全ルーティンの中から探す
        // 簡易的に localStorage のキーをスキャンする
        const keys = Object.keys(localStorage).filter(k => k.startsWith('wabi:exec:') && k.endsWith(`:${date}`))
        for (const lsKey of keys) {
          try {
            const exec = JSON.parse(localStorage.getItem(lsKey) || 'null')
            if (exec?.checkedItems) {
              const checked = Object.values(exec.checkedItems).filter(Boolean).length
              const total = Object.keys(exec.checkedItems).length
              const r = total > 0 ? checked / total : 0
              if (weekDates.includes(date)) { weekTotal += r; weekDays++ }
              if (monthDates.includes(date)) { monthTotal += r; monthDays++ }
              break // 最初に見つかったものを使う
            }
          } catch { /* ignore */ }
        }
      }

      setWeekRatio(weekDays > 0 ? weekTotal / weekDays : 0)
      setMonthRatio(monthDays > 0 ? monthTotal / monthDays : 0)
    }

    loadHistory()
  }, [progress.energy, progress.capacity])

  // 設定変更時にパーティクル再生成
  useEffect(() => {
    dayParticlesRef.current = []
    weekParticlesRef.current = []
    monthParticlesRef.current = []
  }, [dayRings, dayParticleCount])

  // アニメーションループ
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1

    function initCanvas() {
      const rect = canvas!.getBoundingClientRect()
      canvas!.width = rect.width * dpr
      canvas!.height = rect.height * dpr
      return rect
    }

    let rect = initCanvas()
    const w = () => rect.width * dpr
    const h = () => rect.height * dpr

    const dayR = () => Math.min(w() * 0.2, h() * 0.36)
    const subR = () => Math.min(w() * 0.14, h() * 0.28)

    if (dayParticlesRef.current.length === 0) {
      dayParticlesRef.current = createParticles(dayParticleCount, dayRings, dayR())
      weekParticlesRef.current = createParticles(SUB_PARTICLES, SUB_RINGS, subR())
      monthParticlesRef.current = createParticles(SUB_PARTICLES, SUB_RINGS, subR())
    }

    function frame(time: number) {
      const ctx = canvas!.getContext('2d')
      if (!ctx) return

      const cw = canvas!.width
      const ch = canvas!.height

      ctx.clearRect(0, 0, cw, ch)

      const dr = dayR()
      const sr = subR()

      const dayX = cw * 0.32
      const dayY = ch * 0.46
      const weekX = cw * 0.68
      const weekY = ch * 0.32
      const monthX = cw * 0.78
      const monthY = ch * 0.68

      drawGarden(ctx, dayX, dayY, dr, dayRatio, '今日', dpr, time, dayParticlesRef.current, dayRings)
      drawGarden(ctx, weekX, weekY, sr, weekRatio, '今週', dpr, time, weekParticlesRef.current, SUB_RINGS)
      drawGarden(ctx, monthX, monthY, sr, monthRatio, '今月', dpr, time, monthParticlesRef.current, SUB_RINGS)

      drawConnections(ctx, [
        { x: dayX, y: dayY, r: dr },
        { x: weekX, y: weekY, r: sr },
        { x: monthX, y: monthY, r: sr },
      ], dpr, time)

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)

    const handleResize = () => {
      rect = initCanvas()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', handleResize)
    }
  }, [dayRatio, weekRatio, monthRatio, dayRings, dayParticleCount])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: '260px' }}
      />
      {progress.total > 0 && (
        <div className="flex justify-center mt-1">
          <span className="text-[10px] text-wabi-text-muted/40 font-mono">
            獲得 {progress.energy}/{progress.capacity}
          </span>
        </div>
      )}
    </div>
  )
}
