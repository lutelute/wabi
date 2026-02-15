import { useState, useRef, useCallback, useEffect } from 'react'
import { useDay } from '../contexts/DayContext'
import { MOOD_OPTIONS } from '../types/routine'
import type { Mood, MoodEntry, CheckIn } from '../types/routine'

const DEFAULT_FEELING_TAGS = [
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
  lines.push(`# 寂びの記録 (${date})`)
  lines.push('')

  if (moodLog.length > 0) {
    lines.push(`気分の流れ: ${moodLog.map(e => `${e.time} ${MOOD_LABEL[e.mood]}`).join(' → ')}`)
    lines.push('')
  }

  for (const ci of checkIns) {
    lines.push(`## ${ci.time}`)
    lines.push(`淀: ${ci.mental} | 波: ${ci.wave ?? '-'} | 体温: ${ci.bodyTemp ?? '-'} | 体力: ${ci.stamina}`)
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
  const { checkIns, addCheckIn, staminaLog, mentalLog, waveLog, bodyTempLog, moodLog, dailyNotes, addMood, restTaken } = useDay()
  const [comment, setComment] = useState('')
  const [mental, setMental] = useState(50)
  const [wave, setWave] = useState(30)
  const [bodyTemp, setBodyTemp] = useState(50)
  const [tags, setTags] = useState<string[]>([])
  const [customFeelingTags, setCustomFeelingTags] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)
  const staminaBarRef = useRef<HTMLDivElement>(null)
  const mentalBarRef = useRef<HTMLDivElement>(null)
  const waveBarRef = useRef<HTMLDivElement>(null)
  const bodyTempBarRef = useRef<HTMLDivElement>(null)

  // 体力の上限: 最後のチェックイン値、なければ100
  const staminaCeiling = checkIns.length > 0 ? checkIns[checkIns.length - 1].stamina : 100
  const [stamina, setStaminaRaw] = useState(staminaCeiling)
  const [resting, setResting] = useState(false)

  // @rest アイテム完了で自動的に休息モードに
  useEffect(() => {
    if (restTaken && !resting) {
      setResting(true)
      setStaminaRaw(Math.min(staminaCeiling + 30, 100))
    }
  }, [restTaken])

  // チェックイン後に上限が変わったらスライダーも合わせる
  useEffect(() => {
    setStaminaRaw(staminaCeiling)
    setResting(false)
  }, [staminaCeiling])

  // 前回チェックインの値を初期値に
  useEffect(() => {
    if (checkIns.length > 0) {
      const last = checkIns[checkIns.length - 1]
      setMental(last.mental)
      setWave(last.wave ?? 30)
      setBodyTemp(last.bodyTemp ?? 50)
    }
  }, [checkIns.length])

  // 体力は上限を超えないようにキャップ（休息中は解除）
  const setStamina = useCallback((v: number) => {
    setStaminaRaw(resting ? v : Math.min(v, staminaCeiling))
  }, [staminaCeiling, resting])

  const shift = shiftMessage(moodLog)

  const calcValue = (clientX: number, bar: HTMLDivElement) => {
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * 100)
  }

  const handleBarPointerDown = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    ref: React.RefObject<HTMLDivElement | null>,
    setter: (v: number) => void,
  ) => {
    const bar = ref.current
    if (!bar) return
    bar.setPointerCapture(e.pointerId)
    setter(calcValue(e.clientX, bar))

    const onMove = (ev: PointerEvent) => setter(calcValue(ev.clientX, bar))
    const onUp = () => {
      bar.removeEventListener('pointermove', onMove)
      bar.removeEventListener('pointerup', onUp)
    }
    bar.addEventListener('pointermove', onMove)
    bar.addEventListener('pointerup', onUp)
  }, [])

  const toggleTag = useCallback((tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }, [])

  const handleSubmit = useCallback(() => {
    addCheckIn(stamina, mental, wave, bodyTemp, tags, comment)
    setTags([])
    setComment('')
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 1500)
  }, [stamina, mental, wave, bodyTemp, tags, comment, addCheckIn])

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
      <p className="text-xs text-wabi-text-muted mb-3">寂び</p>

      <div className="bg-wabi-surface rounded-lg border border-wabi-border/50 p-4 space-y-4 text-xs">
        {/* 体(左) + 心(右) 2カラム縦並び */}
        <div className="flex gap-4">
          {/* 体 */}
          <div className="flex-1 min-w-0 space-y-3">
            <span className="text-[10px] text-wabi-text-muted/40 block">体</span>
            <GaugeBar
              label="体温"
              value={bodyTemp}
              barRef={bodyTempBarRef}
              gradientFrom="#c4786a"
              gradientTo="#d8a090"
              trackColor="rgba(196,120,106,0.1)"
              onPointerDown={e => handleBarPointerDown(e, bodyTempBarRef, setBodyTemp)}
              labelLeft="冷"
              labelRight="熱"
            />
            <GaugeBar
              label="体力"
              value={stamina}
              ceiling={resting ? undefined : staminaCeiling}
              barRef={staminaBarRef}
              gradientFrom="#8aaa7a"
              gradientTo="#a8c89a"
              trackColor="rgba(138,170,122,0.1)"
              onPointerDown={e => handleBarPointerDown(e, staminaBarRef, setStamina)}
              labelLeft="満"
              labelRight="尽"
              trailing={
                <button
                  onClick={() => {
                    setResting(v => !v)
                    if (!resting) setStaminaRaw(Math.min(staminaCeiling + 30, 100))
                  }}
                  className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors whitespace-nowrap ${
                    resting
                      ? 'bg-indigo-500/15 text-indigo-400'
                      : 'text-wabi-text-muted/40 hover:text-wabi-text-muted hover:bg-wabi-bg'
                  }`}
                >
                  {resting ? '休息中' : '休息'}
                </button>
              }
            />
          </div>
          {/* 心 */}
          <div className="flex-1 min-w-0 space-y-3">
            <span className="text-[10px] text-wabi-text-muted/40 block">心</span>
            <GaugeBar
              label="淀"
              value={mental}
              barRef={mentalBarRef}
              gradientFrom="#8a9298"
              gradientTo="#b0bcc2"
              trackColor="rgba(138,146,152,0.1)"
              onPointerDown={e => handleBarPointerDown(e, mentalBarRef, setMental)}
              labelLeft="濁"
              labelRight="澄"
            />
            <GaugeBar
              label="波"
              value={wave}
              barRef={waveBarRef}
              gradientFrom="#5a8a9a"
              gradientTo="#7eb5c8"
              trackColor="rgba(90,138,154,0.1)"
              onPointerDown={e => handleBarPointerDown(e, waveBarRef, setWave)}
              labelLeft="凪"
              labelRight="荒"
            />
          </div>
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
            {[...DEFAULT_FEELING_TAGS, ...customFeelingTags].map(tag => (
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
            <form
              onSubmit={e => {
                e.preventDefault()
                const t = newTagInput.trim()
                if (t && !DEFAULT_FEELING_TAGS.includes(t) && !customFeelingTags.includes(t)) {
                  setCustomFeelingTags(prev => [...prev, t])
                  setTags(prev => [...prev, t])
                }
                setNewTagInput('')
              }}
              className="inline-flex"
            >
              <input
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                placeholder="+ 追加"
                className="w-16 px-2 py-0.5 rounded-full text-[10px] bg-wabi-bg text-wabi-text placeholder:text-wabi-text-muted/30 border border-transparent focus:border-wabi-border/50 focus:w-24 transition-all duration-200 focus:outline-none"
              />
            </form>
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
        {(mentalLog.length >= 2 || waveLog.length >= 2 || bodyTempLog.length >= 2 || staminaLog.length >= 2) && (
          <div className="pt-2 border-t border-wabi-border/30">
            <div className="flex gap-4">
              {/* 体の推移 (左) */}
              <div className="flex-1 min-w-0 space-y-1">
                {bodyTempLog.length >= 2 && (
                  <div>
                    <span className="text-[10px] text-wabi-text-muted/50">体温</span>
                    <TimeGraph log={bodyTempLog} gradientFrom="#c4786a" gradientTo="#d8a090" />
                  </div>
                )}
                {staminaLog.length >= 2 && (
                  <div>
                    <span className="text-[10px] text-wabi-text-muted/50">体力</span>
                    <TimeGraph log={staminaLog} gradientFrom="#8aaa7a" gradientTo="#a8c89a" />
                  </div>
                )}
              </div>
              {/* 心の推移 (右) */}
              <div className="flex-1 min-w-0 space-y-1">
                {mentalLog.length >= 2 && (
                  <div>
                    <span className="text-[10px] text-wabi-text-muted/50">淀</span>
                    <TimeGraph log={mentalLog} gradientFrom="#8a9298" gradientTo="#b0bcc2" />
                  </div>
                )}
                {waveLog.length >= 2 && (
                  <div>
                    <span className="text-[10px] text-wabi-text-muted/50">波</span>
                    <TimeGraph log={waveLog} gradientFrom="#5a8a9a" gradientTo="#7eb5c8" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 過去のチェックイン */}
        {checkIns.length > 0 && (
          <div className="pt-2 border-t border-wabi-border/30 space-y-2">
            <p className="text-[10px] text-wabi-text-muted/50">今日の寂び ({checkIns.length})</p>
            {checkIns.map((ci, i) => (
              <div key={i} className="bg-wabi-bg rounded-md px-3 py-2 space-y-1">
                <div className="flex items-center gap-2 text-[10px] text-wabi-text-muted flex-wrap">
                  <span className="font-mono opacity-50">{ci.time}</span>
                  <span style={{ color: '#c4786a' }}>体温 {ci.bodyTemp ?? '-'}</span>
                  <span style={{ color: '#8aaa7a' }}>体力 {ci.stamina}</span>
                  <span style={{ color: '#8a9298' }}>淀 {ci.mental}</span>
                  <span style={{ color: '#5a8a9a' }}>波 {ci.wave ?? '-'}</span>
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
function GaugeBar({ label, value, ceiling, barRef, gradientFrom, gradientTo, trackColor, onPointerDown, trailing, labelLeft, labelRight }: {
  label: string
  value: number
  ceiling?: number
  barRef: React.RefObject<HTMLDivElement | null>
  gradientFrom: string
  gradientTo: string
  trackColor: string
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  trailing?: React.ReactNode
  labelLeft?: string
  labelRight?: string
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1 gap-1">
        <span className="text-wabi-text-muted">{label}</span>
        <div className="flex items-center gap-1">
          {trailing}
          <span className="text-[10px] text-wabi-text-muted font-mono">{value}</span>
        </div>
      </div>
      <div
        ref={barRef}
        onPointerDown={onPointerDown}
        className="relative h-4 rounded-full cursor-pointer touch-none"
        style={{ background: trackColor }}
      >
        {ceiling != null && ceiling < 100 && (
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-wabi-text/5"
            style={{ left: `${ceiling}%` }}
          />
        )}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
          }}
        />
        {ceiling != null && ceiling < 100 && (
          <div
            className="absolute inset-y-0 w-px bg-wabi-text/15"
            style={{ left: `${ceiling}%` }}
          />
        )}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm"
          style={{
            left: `${value}%`,
            marginLeft: '-5px',
            background: gradientTo,
          }}
        />
      </div>
      {(labelLeft || labelRight) && (
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] text-wabi-text-muted/40">{labelLeft}</span>
          <span className="text-[9px] text-wabi-text-muted/40">{labelRight}</span>
        </div>
      )}
    </div>
  )
}

/** 時系列グラフ */
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

    ctx.beginPath()
    for (let i = 0; i < points.length; i++) {
      if (i === 0) ctx.moveTo(points[i].x, points[i].y)
      else ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.strokeStyle = gradientFrom
    ctx.lineWidth = 1.5 * dpr
    ctx.lineJoin = 'round'
    ctx.stroke()

    for (const p of points) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2.5 * dpr, 0, Math.PI * 2)
      ctx.fillStyle = gradientTo
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 1 * dpr
      ctx.stroke()
    }

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
