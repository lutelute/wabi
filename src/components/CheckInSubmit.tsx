import { useState, useRef, useCallback, useEffect } from 'react'
import { useDay } from '../contexts/DayContext'
import { MOOD_OPTIONS } from '../types/routine'
import type { Mood, MoodEntry, CheckIn } from '../types/routine'

const FEELING_TAGS = [
  '疲れた', 'すっきり', '不安', '焦り', '充実', '眠い',
  '集中できた', '散漫', 'イライラ', 'リラックス', '達成感', '無気力',
]

const MOOD_INDEX: Record<Mood, number> = {
  heavy: 0, cloudy: 1, flat: 2, calm: 3, light: 4,
}

const MOOD_LABEL: Record<Mood, string> = {
  heavy: '重い', cloudy: 'もやもや', flat: 'ふつう', calm: '穏やか', light: '軽い',
}

function shiftMessage(log: MoodEntry[]): string | null {
  if (log.length < 2) return null
  const first = MOOD_INDEX[log[0].mood]
  const last = MOOD_INDEX[log[log.length - 1].mood]
  const diff = last - first
  if (diff >= 2) return '心がだいぶ軽くなった'
  if (diff === 1) return '少し軽くなった'
  if (diff <= -2) return '疲れてる。休んでいい。'
  if (diff === -1) return '少し重くなったかも'
  return null
}

function buildCheckInText(checkIns: CheckIn[], moodLog: MoodEntry[], dailyNotes: string, date: string): string {
  const lines: string[] = []
  lines.push(`# こころの記録 (${date})`)
  lines.push('')

  if (moodLog.length > 0) {
    lines.push(`気分の流れ: ${moodLog.map(e => `${e.time} ${MOOD_LABEL[e.mood]}`).join(' → ')}`)
    lines.push('')
  }

  for (const ci of checkIns) {
    lines.push(`## ${ci.time}`)
    lines.push(`体力: ${ci.stamina}/100 | 心: ${ci.mental}/100`)
    if (ci.tags.length > 0) {
      lines.push(`気持ち: ${ci.tags.map(t => `#${t}`).join(' ')}`)
    }
    if (ci.comment) {
      lines.push(`メモ: ${ci.comment}`)
    }
    lines.push('')
  }

  if (dailyNotes) {
    lines.push(`心のメモ: ${dailyNotes}`)
    lines.push('')
  }

  return lines.join('\n')
}

interface LevelEntry { level: number; time: string }

export function CheckInSubmit() {
  const { checkIns, addCheckIn, staminaLog, mentalLog, moodLog, dailyNotes, addMood } = useDay()
  const [comment, setComment] = useState('')
  const [stamina, setStamina] = useState(50)
  const [mental, setMental] = useState(50)
  const [tags, setTags] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)
  const staminaBarRef = useRef<HTMLDivElement>(null)
  const mentalBarRef = useRef<HTMLDivElement>(null)

  const shift = shiftMessage(moodLog)

  const handleBarClick = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    ref: React.RefObject<HTMLDivElement | null>,
    setter: (v: number) => void,
  ) => {
    const bar = ref.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setter(Math.round(ratio * 100))
  }, [])

  const toggleTag = useCallback((tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }, [])

  const handleSubmit = useCallback(() => {
    addCheckIn(stamina, mental, tags, comment)
    setTags([])
    setComment('')
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 1500)
  }, [stamina, mental, tags, comment, addCheckIn])

  const handleCopy = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10)
    const text = buildCheckInText(checkIns, moodLog, dailyNotes, date)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [checkIns, moodLog, dailyNotes])

  return (
    <div className="px-1">
      <p className="text-xs text-wabi-text-muted mb-3">チェックイン</p>

      <div className="bg-wabi-surface rounded-lg border border-wabi-border/50 p-4 space-y-4 text-xs">
        {/* 体力・心バー (1行) */}
        <div className="flex gap-3">
          <GaugeBar
            label="体力"
            value={stamina}
            barRef={staminaBarRef}
            gradientFrom="#059669"
            gradientTo="#34d399"
            trackColor="rgba(5,150,105,0.1)"
            onClick={e => handleBarClick(e, staminaBarRef, setStamina)}
          />
          <GaugeBar
            label="心"
            value={mental}
            barRef={mentalBarRef}
            gradientFrom="#0284c7"
            gradientTo="#38bdf8"
            trackColor="rgba(2,132,199,0.1)"
            onClick={e => handleBarClick(e, mentalBarRef, setMental)}
          />
        </div>

        {/* 気分 */}
        <div>
          <div className="flex gap-1">
            {MOOD_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => addMood(value)}
                className="flex-1 py-1.5 text-xs rounded-lg cursor-pointer transition-colors text-wabi-text-muted hover:bg-wabi-bg hover:text-wabi-text active:bg-wabi-accent/20"
              >
                {label}
              </button>
            ))}
          </div>

          {/* 気分タイムライン */}
          {moodLog.length > 0 && (
            <div className="mt-2 flex items-center gap-1 flex-wrap">
              {moodLog.map((entry, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-0.5 text-[10px] text-wabi-text-muted bg-wabi-bg px-1.5 py-0.5 rounded"
                >
                  <span className="font-mono opacity-50">{entry.time}</span>
                  <span>{MOOD_LABEL[entry.mood]}</span>
                </span>
              ))}
            </div>
          )}
          {shift && (
            <p className="text-[10px] text-wabi-check mt-1">{shift}</p>
          )}
        </div>

        {/* 気持ちタグ */}
        <div>
          <span className="text-wabi-text-muted block mb-1.5">気持ち</span>
          <div className="flex flex-wrap gap-1.5">
            {FEELING_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 py-0.5 rounded-full text-[10px] transition-all duration-150 ${
                  tags.includes(tag)
                    ? 'bg-wabi-text/10 text-wabi-text border border-wabi-text/20'
                    : 'bg-wabi-bg text-wabi-text-muted hover:bg-wabi-border/30'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* ひとことメモ */}
        <input
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="ひとこと (任意)"
          className="w-full bg-wabi-bg border border-wabi-border/50 rounded-md px-3 py-2 text-xs text-wabi-text placeholder:text-wabi-text-muted/40 focus:outline-none focus:border-wabi-text/20"
        />

        {/* 記録ボタン */}
        <button
          onClick={handleSubmit}
          className={`w-full py-2.5 rounded-md text-xs font-medium transition-all duration-200 ${
            submitted
              ? 'bg-emerald-600/20 text-emerald-600'
              : 'bg-wabi-text/5 hover:bg-wabi-text/10 text-wabi-text'
          }`}
        >
          {submitted ? '記録しました' : '記録する'}
        </button>

        {/* 時系列グラフ */}
        {(staminaLog.length >= 2 || mentalLog.length >= 2) && (
          <div className="pt-2 border-t border-wabi-border/30">
            <div className="flex gap-3">
              {staminaLog.length >= 2 && (
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-wabi-text-muted/50">体力の推移</span>
                  <TimeGraph log={staminaLog} gradientFrom="#059669" gradientTo="#34d399" />
                </div>
              )}
              {mentalLog.length >= 2 && (
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-wabi-text-muted/50">心の推移</span>
                  <TimeGraph log={mentalLog} gradientFrom="#0284c7" gradientTo="#38bdf8" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 過去のチェックイン */}
        {checkIns.length > 0 && (
          <div className="pt-2 border-t border-wabi-border/30 space-y-2">
            <p className="text-[10px] text-wabi-text-muted/50">今日のチェックイン ({checkIns.length})</p>
            {checkIns.map((ci, i) => (
              <div key={i} className="bg-wabi-bg rounded-md px-3 py-2 space-y-1">
                <div className="flex items-center gap-3 text-[10px] text-wabi-text-muted">
                  <span className="font-mono opacity-50">{ci.time}</span>
                  <span className="text-emerald-600">体力 {ci.stamina}</span>
                  <span className="text-sky-500">心 {ci.mental}</span>
                </div>
                {ci.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {ci.tags.map(t => (
                      <span key={t} className="text-[9px] bg-wabi-surface px-1.5 py-0.5 rounded-full text-wabi-text-muted">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                {ci.comment && (
                  <p className="text-[10px] text-wabi-text-muted italic">{ci.comment}</p>
                )}
              </div>
            ))}

            {/* コピーボタン */}
            <button
              onClick={handleCopy}
              className={`w-full py-2 rounded-md text-[10px] transition-all duration-200 ${
                copied
                  ? 'bg-emerald-600/20 text-emerald-600'
                  : 'bg-wabi-bg hover:bg-wabi-border/30 text-wabi-text-muted'
              }`}
            >
              {copied ? 'コピーしました — AIに貼り付けてください' : '全記録をコピー'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** ゲージバー */
function GaugeBar({ label, value, barRef, gradientFrom, gradientTo, trackColor, onClick }: {
  label: string
  value: number
  barRef: React.RefObject<HTMLDivElement | null>
  gradientFrom: string
  gradientTo: string
  trackColor: string
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-wabi-text-muted">{label}</span>
        <span className="text-[10px] text-wabi-text-muted font-mono">{value}</span>
      </div>
      <div
        ref={barRef}
        onClick={onClick}
        className="relative h-3 rounded-full cursor-pointer"
        style={{ background: trackColor }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-150"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm transition-all duration-150"
          style={{
            left: `${value}%`,
            marginLeft: '-5px',
            background: gradientTo,
          }}
        />
      </div>
    </div>
  )
}

/** 時系列グラフ (SelfGaugeから移植) */
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

    const parseTime = (t: string) => {
      const [hh, mm] = t.split(':').map(Number)
      return hh * 60 + mm
    }
    const times = log.map(e => parseTime(e.time))
    const tMin = times[0]
    const tMax = times[times.length - 1]
    const tRange = Math.max(tMax - tMin, 1)

    // 水平目盛り線
    ctx.strokeStyle = 'rgba(138,132,128,0.08)'
    ctx.lineWidth = dpr
    for (const lv of [25, 50, 75]) {
      const y = pad.top + plotH * (1 - lv / 100)
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.stroke()
    }

    const points = log.map((e, i) => ({
      x: pad.left + (plotW * (times[i] - tMin)) / tRange,
      y: pad.top + plotH * (1 - e.level / 100),
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

    // 時刻ラベル
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
      className="w-full mt-1"
      style={{ height: '50px' }}
    />
  )
}
