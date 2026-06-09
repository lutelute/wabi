import { useEffect, useRef } from 'react'
import { useDay } from '../contexts/DayContext'
import { useActionList } from '../contexts/ActionListContext'
import { loadRecentDays } from '../utils/weeklyData'
import type { ExternalRequest, Mood } from '../types/routine'

/**
 * 対話レイヤー（Local API）からのリクエストを、正規のContext関数で処理する。
 * Electron版でのみ動作（window.electronAPI.onExternalRequest があるとき）。
 *
 * 書き込みはすべてここを通る → デバウンス保存・クラウド同期・Obsidian・庭への反映が
 * 通常操作とまったく同じルートに乗る。mainがstoreを直書きしないのはこのため。
 */

const VALID_MOODS: Mood[] = ['heavy', 'cloudy', 'flat', 'calm', 'light']
const WRITE_ACTIONS = ['checkin', 'mood', 'note', 'declined', 'action-check']
const MAX_TEXT_LEN = 4000  // note/declined の肥大防止

function clamp100(v: unknown, fallback = 50): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function ExternalBridge() {
  const day = useDay()
  const al = useActionList()

  // 最新のContext値・関数を常に参照できるようにrefで保持
  const ref = useRef({ day, al })
  useEffect(() => { ref.current = { day, al } })

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onExternalRequest || !api.sendExternalResponse) return

    const process = async (action: ExternalRequest['action'], payload: any): Promise<unknown> => {
      const { day, al } = ref.current

      // 閉じた日には書き込まない（区切りを尊重する。再開はUIから）
      if (WRITE_ACTIONS.includes(action) && day.closedAt) {
        throw new Error('今日はすでに閉じられています。記録するには、wabiで「再開する」を押してください。')
      }

      switch (action) {
        case 'today': {
          const doneCount = al.actions.filter(a => al.checkedItems[a.id]).length
          const lastCi = day.checkIns[day.checkIns.length - 1]
          return {
            date: day.date,
            closed: !!day.closedAt,
            checkIns: day.checkIns,
            latestCheckIn: lastCi ?? null,
            moodLog: day.moodLog,
            restTaken: day.restTaken,
            dailyNotes: day.dailyNotes,
            actions: al.actions.map(a => ({
              title: a.title,
              done: !!al.checkedItems[a.id],
              isRest: a.isRest,
              isMental: a.isMental,
            })),
            completion: { done: doneCount, total: al.actions.length },
            declined: al.declined,
          }
        }

        case 'recent': {
          const n = Math.max(1, Math.min(31, Number(payload?.days) || 7))
          const records = await loadRecentDays(n)
          // 今日分はメモリ状態で上書き（storageはデバウンス保存待ちの可能性）
          const today = day.date
          return records.map(r => {
            if (r.date === today) {
              const doneCount = al.actions.filter(a => al.checkedItems[a.id]).length
              return {
                date: r.date,
                checkIns: day.checkIns.length,
                moods: day.moodLog.length,
                completion: { done: doneCount, total: al.actions.length },
                restTaken: day.restTaken,
                declined: al.declined,
                latestStamina: day.staminaLog.length ? day.staminaLog[day.staminaLog.length - 1].level : null,
              }
            }
            const cis = r.day?.checkIns ?? []
            const acts = r.actions?.actions ?? []
            const checked = r.actions?.checkedItems ?? {}
            return {
              date: r.date,
              checkIns: cis.length,
              moods: (r.day?.moodLog ?? []).length,
              completion: { done: acts.filter(a => checked[a.id]).length, total: acts.length },
              restTaken: r.day?.restTaken ?? false,
              declined: r.actions?.declined ?? '',
              latestStamina: r.day?.staminaLog?.length ? r.day.staminaLog[r.day.staminaLog.length - 1].level : null,
            }
          })
        }

        case 'checkin': {
          const stamina = clamp100(payload?.stamina, 60)
          const mental = clamp100(payload?.mental, 50)
          const wave = clamp100(payload?.wave, 30)
          const bodyTemp = clamp100(payload?.bodyTemp, 50)
          const tags = Array.isArray(payload?.tags) ? payload.tags.map(String).slice(0, 12) : []
          const comment = typeof payload?.comment === 'string' ? payload.comment : ''
          day.addCheckIn(stamina, mental, wave, bodyTemp, tags, comment, 'dialog')
          // checkInCountはsetState非同期のため正確な値を返せない。recordedのみ返す
          return { recorded: { stamina, mental, wave, bodyTemp, tags, comment } }
        }

        case 'mood': {
          const mood = payload?.mood as Mood
          if (!VALID_MOODS.includes(mood)) throw new Error(`invalid mood: ${mood}`)
          day.addMood(mood)
          return { recorded: mood }
        }

        case 'note': {
          const text = typeof payload?.text === 'string' ? payload.text.trim() : ''
          if (!text) throw new Error('empty note')
          const mode = payload?.mode === 'replace' ? 'replace' : 'append'
          let next = mode === 'replace' || !day.dailyNotes
            ? text
            : `${day.dailyNotes}\n${text}`
          if (next.length > MAX_TEXT_LEN) next = next.slice(next.length - MAX_TEXT_LEN)
          day.setDailyNotes(next)
          return { mode, length: next.length }
        }

        case 'declined': {
          const text = typeof payload?.text === 'string' ? payload.text.trim() : ''
          if (!text) throw new Error('empty declined')
          const mode = payload?.mode === 'replace' ? 'replace' : 'append'
          let next = mode === 'replace' || !al.declined
            ? text
            : `${al.declined}\n${text}`
          if (next.length > MAX_TEXT_LEN) next = next.slice(next.length - MAX_TEXT_LEN)
          al.updateDeclined(next)
          return { mode, text: next }
        }

        case 'action-check': {
          const title = typeof payload?.title === 'string' ? payload.title.trim() : ''
          if (!title) throw new Error('empty title')
          // 完全一致を最優先。なければ部分一致だが、複数該当なら曖昧エラー（誤完了を防ぐ）
          const exact = al.actions.find(a => a.title === title && !al.checkedItems[a.id])
          if (exact) {
            al.toggleCheck(exact.id)
            return { checked: exact.title }
          }
          const partials = al.actions.filter(a => a.title.includes(title) && !al.checkedItems[a.id])
          if (partials.length === 0) throw new Error(`未完了のアクションに「${title}」が見つかりません`)
          if (partials.length > 1) {
            throw new Error(`「${title}」に複数該当します（${partials.map(p => p.title).join(' / ')}）。正確なタイトルを指定してください。`)
          }
          al.toggleCheck(partials[0].id)
          return { checked: partials[0].title }
        }

        default:
          throw new Error(`unknown action: ${action}`)
      }
    }

    const unsub = api.onExternalRequest(async (req) => {
      const r = req as ExternalRequest
      try {
        const data = await process(r.action, r.payload)
        api.sendExternalResponse!({ id: r.id, ok: true, data })
      } catch (e: any) {
        api.sendExternalResponse!({ id: r.id, ok: false, error: e?.message || String(e) })
      }
    })

    return unsub
  }, [])

  return null
}
