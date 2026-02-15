import { getSupabase, isCloudEnabled } from './supabaseClient'

interface WabiDataRow {
  id: string
  user_id: string
  data_key: string
  data: unknown
  updated_at: string
}

// オフライン変更キュー
const pendingQueue: Map<string, { data: unknown; timestamp: string }> = new Map()
let isSyncing = false

export async function isAuthenticated(): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function pullAll(): Promise<Record<string, unknown> | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  if (!(await isAuthenticated())) return null

  const { data, error } = await supabase
    .from('wabi_data')
    .select('data_key, data, updated_at')

  if (error) {
    console.error('[sync] pullAll error:', error.message)
    return null
  }

  const result: Record<string, unknown> = {}
  for (const row of data as WabiDataRow[]) {
    result[row.data_key] = row.data
  }
  return result
}

export async function pushKey(key: string, data: unknown): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false
  if (!(await isAuthenticated())) {
    // オフライン or 未認証 → キューに追加
    pendingQueue.set(key, { data, timestamp: new Date().toISOString() })
    return false
  }

  const userId = await getCurrentUserId()
  if (!userId) return false

  const { error } = await supabase
    .from('wabi_data')
    .upsert(
      {
        user_id: userId,
        data_key: key,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,data_key' }
    )

  if (error) {
    console.error('[sync] pushKey error:', error.message)
    pendingQueue.set(key, { data, timestamp: new Date().toISOString() })
    return false
  }

  return true
}

export async function syncAll(): Promise<void> {
  if (isSyncing) return
  isSyncing = true

  try {
    // 1. キューに溜まった変更をpush
    for (const [key, { data }] of pendingQueue) {
      const success = await pushKey(key, data)
      if (success) pendingQueue.delete(key)
    }
  } finally {
    isSyncing = false
  }
}

export async function flushPendingQueue(): Promise<void> {
  if (pendingQueue.size === 0) return
  await syncAll()
}

// デバウンス付きpush
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function debouncedPush(key: string, data: unknown, delayMs = 5000): void {
  if (!isCloudEnabled()) return

  const existing = debounceTimers.get(key)
  if (existing) clearTimeout(existing)

  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key)
      pushKey(key, data)
    }, delayMs)
  )
}

// オンライン復帰リスナー
export function setupOnlineListener(): () => void {
  const handler = () => {
    console.log('[sync] online - flushing queue')
    flushPendingQueue()
  }
  window.addEventListener('online', handler)
  return () => window.removeEventListener('online', handler)
}
