import { useRef, useCallback, useEffect } from 'react'
import { useDay } from '../contexts/DayContext'

interface LevelEntry {
  level: number
  time: string
}

export function SelfGauge() {
  const { staminaLog, mentalLog, addStamina, addMental } = useDay()

  return (
    <div className="px-1 space-y-4">
      <GaugeRow
        label="体力"
        gradientFrom="#059669"
        gradientTo="#34d399"
        trackColor="rgba(5,150,105,0.1)"
        log={staminaLog}
        onRecord={addStamina}
      />
      <GaugeRow
        label="心"
        gradientFrom="#0284c7"
        gradientTo="#38bdf8"
        trackColor="rgba(2,132,199,0.1)"
        log={mentalLog}
        onRecord={addMental}
      />
    </div>
  )
}

function GaugeRow({ label, gradientFrom, gradientTo, trackColor, log, onRecord }: {
  label: string
  gradientFrom: string
  gradientTo: string
  trackColor: string
  log: LevelEntry[]
  onRecord: (level: number) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const current = log.length > 0 ? log[log.length - 1].level : 0

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = barRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const level = Math.round(ratio * 100)
    onRecord(level)
  }, [onRecord])

  // 目盛り
  const ticks = [0, 25, 50, 75, 100]

  return (
    <div>
      {/* ラベル + 現在値 */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-wabi-text-muted">{label}</span>
        <span className="text-[10px] text-wabi-text-muted font-mono">
          {current > 0 ? current : '-'}
        </span>
      </div>

      {/* バー */}
      <div
        ref={barRef}
        onClick={handleClick}
        className="relative h-4 rounded-full cursor-pointer"
        style={{ background: trackColor }}
      >
        {/* 目盛り */}
        {ticks.map(t => (
          <div
            key={t}
            className="absolute top-0 h-full"
            style={{ left: `${t}%` }}
          >
            <div className="w-px h-full opacity-15" style={{ background: gradientFrom }} />
          </div>
        ))}

        {/* 塗り */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
          style={{
            width: `${current}%`,
            background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
          }}
        />

        {/* つまみ */}
        {current > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm transition-all duration-200"
            style={{
              left: `${current}%`,
              marginLeft: '-6px',
              background: gradientTo,
            }}
          />
        )}
      </div>

      {/* 目盛りラベル */}
      <div className="flex justify-between mt-0.5 px-0.5">
        {ticks.map(t => (
          <span key={t} className="text-[8px] text-wabi-text-muted/30 font-mono">{t}</span>
        ))}
      </div>

      {/* 時間変化グラフ */}
      {log.length >= 2 && (
        <TimeGraph log={log} gradientFrom={gradientFrom} gradientTo={gradientTo} />
      )}
    </div>
  )
}

function TimeGraph({ log, gradientFrom, gradientTo }: {
  log: LevelEntry[]
  gradientFrom: string
  gradientTo: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || log.length < 2) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const pad = { top: 8 * dpr, bottom: 14 * dpr, left: 2 * dpr, right: 2 * dpr }
    const plotW = w - pad.left - pad.right
    const plotH = h - pad.top - pad.bottom

    ctx.clearRect(0, 0, w, h)

    // 時間軸: 最初のエントリから最後のエントリ
    const parseTime = (t: string) => {
      const [hh, mm] = t.split(':').map(Number)
      return hh * 60 + mm
    }
    const times = log.map(e => parseTime(e.time))
    const tMin = times[0]
    const tMax = times[times.length - 1]
    const tRange = Math.max(tMax - tMin, 1)

    // 水平目盛り線 (25, 50, 75)
    ctx.strokeStyle = 'rgba(138,132,128,0.08)'
    ctx.lineWidth = dpr
    for (const lv of [25, 50, 75]) {
      const y = pad.top + plotH * (1 - lv / 100)
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.stroke()
    }

    // ポイント座標
    const points = log.map((e, i) => ({
      x: pad.left + (plotW * (times[i] - tMin)) / tRange,
      y: pad.top + plotH * (1 - e.level / 100),
      entry: e,
    }))

    // エリア塗り
    const gradient = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom)
    gradient.addColorStop(0, gradientFrom + '30')
    gradient.addColorStop(1, gradientFrom + '05')
    ctx.beginPath()
    ctx.moveTo(points[0].x, h - pad.bottom)
    for (const p of points) ctx.lineTo(p.x, p.y)
    ctx.lineTo(points[points.length - 1].x, h - pad.bottom)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // 線
    ctx.beginPath()
    for (let i = 0; i < points.length; i++) {
      if (i === 0) ctx.moveTo(points[i].x, points[i].y)
      else ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.strokeStyle = gradientFrom
    ctx.lineWidth = 1.5 * dpr
    ctx.lineJoin = 'round'
    ctx.stroke()

    // ドット
    for (const p of points) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2.5 * dpr, 0, Math.PI * 2)
      ctx.fillStyle = gradientTo
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 1 * dpr
      ctx.stroke()
    }

    // 時刻ラベル (最初と最後)
    ctx.fillStyle = 'rgba(138,132,128,0.4)'
    ctx.font = `${8 * dpr}px system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(log[0].time, points[0].x, h - 2 * dpr)
    ctx.textAlign = 'right'
    ctx.fillText(log[log.length - 1].time, points[points.length - 1].x, h - 2 * dpr)
  }, [log, gradientFrom, gradientTo])

  return (
    <canvas
      ref={canvasRef}
      className="w-full mt-2"
      style={{ height: '60px' }}
    />
  )
}
