import { useState, useEffect, type ReactNode } from 'react'
import { getSupabase, isCloudEnabled } from '../sync/supabaseClient'

interface Props {
  children: ReactNode
}

export function AuthGate({ children }: Props) {
  const [state, setState] = useState<'loading' | 'login' | 'sent' | 'authenticated'>('loading')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const isElectron = !!window.electronAPI

  useEffect(() => {
    // Electron版 or Cloud未設定 → ログインスキップ
    if (isElectron || !isCloudEnabled()) {
      setState('authenticated')
      return
    }

    const supabase = getSupabase()
    if (!supabase) {
      setState('authenticated')
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setState(data.session ? 'authenticated' : 'login')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? 'authenticated' : 'login')
    })

    return () => subscription.unsubscribe()
  }, [isElectron])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const supabase = getSupabase()
    if (!supabase) return

    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/wabi/' },
    })

    if (err) {
      setError(err.message)
    } else {
      setState('sent')
    }
  }

  if (state === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-wabi-bg">
        <p className="text-sm text-wabi-text-muted">読み込み中…</p>
      </div>
    )
  }

  if (state === 'authenticated') {
    return <>{children}</>
  }

  if (state === 'sent') {
    return (
      <div className="h-screen flex items-center justify-center bg-wabi-bg">
        <div className="text-center space-y-4 max-w-sm mx-4">
          <h1 className="text-lg font-medium text-wabi-text">メールを確認してください</h1>
          <p className="text-sm text-wabi-text-muted">
            <span className="font-medium text-wabi-text">{email}</span> にログインリンクを送信しました。
            メール内のリンクをクリックしてログインしてください。
          </p>
          <button
            onClick={() => setState('login')}
            className="text-sm text-wabi-accent hover:text-wabi-text cursor-pointer"
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  // login画面
  return (
    <div className="h-screen flex items-center justify-center bg-wabi-bg">
      <div className="w-full max-w-sm mx-4 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-medium text-wabi-text">侘び</h1>
          <p className="text-sm text-wabi-text-muted">ルーティン管理</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="メールアドレス"
              required
              className="w-full px-4 py-3 text-sm border border-wabi-border rounded-xl bg-wabi-surface text-wabi-text placeholder:text-wabi-text-muted focus:outline-none focus:border-wabi-accent"
            />
          </div>

          {error && (
            <p className="text-xs text-wabi-timer">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3 text-sm font-medium bg-wabi-accent/20 text-wabi-text rounded-xl hover:bg-wabi-accent/30 transition-colors cursor-pointer"
          >
            マジックリンクでログイン
          </button>
        </form>

        <p className="text-xs text-wabi-text-muted text-center">
          パスワード不要。メールにログインリンクが届きます。
        </p>
      </div>
    </div>
  )
}
