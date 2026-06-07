import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  loadRecentDays, axisSeries, completionSeries, tagFrequency,
  declinedList, moodByDay, activeDayCount, shortDate, buildWeeklyAiText,
  type DayRecord, type AxisKey,
} from '../utils/weeklyData'
import { findInsight } from '../utils/insights'
import { weekdayLabel } from '../utils/wabiDate'
import type { Mood } from '../types/routine'

const MOOD_LABEL: Record<Mood, string> = {
  heavy: '重い', cloudy: 'もやもや', flat: 'ふつう', calm: '穏やか', light: '軽い',
}

const AXES: { key: AxisKey; label: string; color: string; left: string; right: string }[] = [
  { key: 'bodyTemp', label: '体温', color: '#c4786a', left: '冷', right: '熱' },
  { key: 'stamina', label: '体力', color: '#8aaa7a', left: '尽', right: '満' },
  { key: 'mental', label: '淀', color: '#8a9298', left: '濁', right: '澄' },
  { key: 'wave', label: '波', color: '#5a8a9a', left: '凪', right: '荒' },
]

/** 7日分の折れ線（SVG）。データのない日は線が途切れる。 */
function AxisChart({ values, color }: { values: (number | null)[]; color: string }) {
  const W = 280
  const H = 56
  const PAD = 6

  const points = values.map((v, i) => ({
    x: PAD + (i * (W - PAD * 2)) / Math.max(values.length - 1, 1),
    y: v == null ? null : PAD + (H - PAD * 2) * (1 - v / 100),
    v,
  }))

  // 連続区間ごとにパスを分ける
  const segments: { x: number; y: number }[][] = []
  let current: { x: number; y: number }[] = []
  for (const p of points) {
    if (p.y == null) {
      if (current.length > 0) { segments.push(current); current = [] }
    } else {
      current.push({ x: p.x, y: p.y })
    }
  }
  if (current.length > 0) segments.push(current)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '42px' }}>
      {/* 基準線 (50) */}
      <line
        x1={PAD} x2={W - PAD}
        y1={PAD + (H - PAD * 2) * 0.5} y2={PAD + (H - PAD * 2) * 0.5}
        stroke="rgba(138,132,128,0.12)" strokeWidth="1" strokeDasharray="2 4"
      />
      {segments.map((seg, si) => (
        <polyline
          key={si}
          points={seg.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.75"
        />
      ))}
      {points.map((p, i) =>
        p.y != null ? (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} opacity="0.9" />
        ) : null,
      )}
    </svg>
  )
}

export function WeeklyReview({ onClose }: { onClose: () => void }) {
  const [records, setRecords] = useState<DayRecord[] | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadRecentDays(7).then(setRecords)
  }, [])

  // Esc で閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleCopyForAi = useCallback(() => {
    if (!records) return
    navigator.clipboard.writeText(buildWeeklyAiText(records)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }, [records])

  const insight = useMemo(() => (records ? findInsight(records) : null), [records])

  const content = useMemo(() => {
    if (!records) return null
    return {
      axes: AXES.map(axis => ({ ...axis, values: axisSeries(records, axis.key) })),
      completions: completionSeries(records),
      tags: tagFrequency(records).slice(0, 6),
      declined: declinedList(records),
      moods: moodByDay(records),
      activeDays: activeDayCount(records),
      from: records[0].date,
      to: records[records.length - 1].date,
    }
  }, [records])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-wabi-bg rounded-xl border border-wabi-border/60 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-wabi-bg/95 backdrop-blur-sm px-5 py-4 border-b border-wabi-border/40 flex items-center justify-between">
          <div>
            <h2 className="text-sm text-wabi-text">庭を眺める</h2>
            {content && (
              <p className="text-[10px] text-wabi-text-muted/50 font-mono mt-0.5">
                {shortDate(content.from)} – {shortDate(content.to)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-wabi-text-muted/40 hover:text-wabi-text-muted cursor-pointer text-lg leading-none px-1"
          >
            ×
          </button>
        </div>

        {!content ? (
          <div className="p-10 text-center">
            <p className="text-xs text-wabi-text-muted/40">…</p>
          </div>
        ) : content.activeDays === 0 ? (
          <div className="p-10 text-center space-y-1">
            <p className="text-xs text-wabi-text-muted">この7日の記録はまだありません</p>
            <p className="text-[10px] text-wabi-text-muted/40">記録が増えると、ここに庭が見えてきます</p>
          </div>
        ) : (
          <div className="p-5 space-y-6">
            {/* 4軸の推移（チェックインがある週だけ） */}
            {content.axes.some(a => a.values.some(v => v != null)) && (
              <section>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
                  {content.axes.map(axis => (
                    <div key={axis.key}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] text-wabi-text-muted">{axis.label}</span>
                        <span className="text-[9px] text-wabi-text-muted/30">{axis.left} ↔ {axis.right}</span>
                      </div>
                      <AxisChart values={axis.values} color={axis.color} />
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-wabi-text-muted/30 text-right mt-1">← 7日前 / 今日 →</p>
              </section>
            )}

            {/* 曜日ヘッダー（気分・ほどきの列に対応） */}
            <div className="flex justify-between gap-1 -mb-4">
              {records!.map(r => (
                <span key={r.date} className="flex-1 text-center text-[9px] text-wabi-text-muted/40">
                  {weekdayLabel(r.date)}
                </span>
              ))}
            </div>

            {/* 気分の流れ */}
            {content.moods.some(m => m.mood) && (
              <section>
                <p className="text-[10px] text-wabi-text-muted/50 mb-1.5">気分</p>
                <div className="flex justify-between gap-1">
                  {content.moods.map(m => (
                    <span key={m.date} className="flex-1 text-center text-[10px] text-wabi-text-muted">
                      {m.mood ? MOOD_LABEL[m.mood] : <span className="opacity-20">–</span>}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* ほどき */}
            {content.completions.some(c => c.total > 0) && (
              <section>
                <p className="text-[10px] text-wabi-text-muted/50 mb-1.5">ほどき</p>
                <div className="flex justify-between gap-1">
                  {content.completions.map(c => (
                    <div key={c.date} className="flex-1 text-center">
                      {c.total > 0 ? (
                        <>
                          <div className="h-8 flex items-end justify-center mb-1">
                            <div
                              className="w-1.5 rounded-full bg-wabi-accent/50"
                              style={{ height: `${Math.max((c.done / c.total) * 100, 6)}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-wabi-text-muted/50 font-mono">
                            {c.done}/{c.total}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="h-8 mb-1" />
                          <span className="text-[9px] text-wabi-text-muted/20">–</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* よく出た気持ち */}
            {content.tags.length > 0 && (
              <section>
                <p className="text-[10px] text-wabi-text-muted/50 mb-1.5">よく出た気持ち</p>
                <div className="flex flex-wrap gap-1.5">
                  {content.tags.map(({ tag, count }) => (
                    <span
                      key={tag}
                      className="text-[10px] bg-wabi-surface px-2 py-0.5 rounded-full text-wabi-text-muted"
                    >
                      #{tag}
                      {count > 1 && <span className="opacity-40 ml-1">×{count}</span>}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* 手放したもの */}
            {content.declined.length > 0 && (
              <section>
                <p className="text-[10px] text-wabi-text-muted/50 mb-1.5">手放したもの</p>
                <div className="space-y-1">
                  {content.declined.map(d => (
                    <p key={d.date} className="text-[11px] text-wabi-text-muted">
                      <span className="font-mono text-[9px] opacity-40 mr-2">{shortDate(d.date)}</span>
                      {d.text}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {/* 気づきの種 */}
            {insight && (
              <section className="pt-1">
                <p className="text-[11px] text-wabi-check/80 text-center">{insight}</p>
              </section>
            )}

            {/* AIに相談 */}
            <section className="pt-2 border-t border-wabi-border/30">
              <button
                onClick={handleCopyForAi}
                className={`w-full py-2.5 rounded-md text-[11px] transition-all duration-200 cursor-pointer ${
                  copied
                    ? 'bg-emerald-600/15 text-emerald-700'
                    : 'bg-wabi-surface hover:bg-wabi-border/30 text-wabi-text-muted'
                }`}
              >
                {copied ? 'コピーしました — AIに貼り付けて振り返りを' : '7日分をAI相談用にコピー'}
              </button>
              <p className="text-[9px] text-wabi-text-muted/30 text-center mt-1.5">
                記録と「責めない振り返り」のお願いがセットでコピーされます
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
