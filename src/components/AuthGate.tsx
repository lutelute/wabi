import { useState, useEffect, type ReactNode } from 'react'
import { getSupabase, isCloudEnabled } from '../sync/supabaseClient'

type AuthMethod = 'magic' | 'password'
type AuthMode = 'login' | 'signup'

interface Props {
  children: ReactNode
}

export function AuthGate({ children }: Props) {
  const [state, setState] = useState<'loading' | 'form' | 'sent' | 'authenticated'>('loading')
  const [method, setMethod] = useState<AuthMethod>('password')
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isElectron = !!window.electronAPI

  useEffect(() => {
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
      setState(data.session ? 'authenticated' : 'form')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? 'authenticated' : 'form')
    })

    return () => subscription.unsubscribe()
  }, [isElectron])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = getSupabase()
    if (!supabase) return

    try {
      if (method === 'magic') {
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin + '/wabi/' },
        })
        if (err) { setError(err.message); return }
        setState('sent')
      } else if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) { setError(err.message); return }
        // autoconfirmが有効なので即ログイン状態になる
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) {
          setError(err.message === 'Invalid login credentials' ? 'メールアドレスまたはパスワードが違います' : err.message)
          return
        }
      }
    } finally {
      setLoading(false)
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
            onClick={() => setState('form')}
            className="text-sm text-wabi-accent hover:text-wabi-text cursor-pointer"
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex items-center justify-center bg-wabi-bg">
      <div className="w-full max-w-sm mx-4 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-medium text-wabi-text">侘び</h1>
          <p className="text-sm text-wabi-text-muted">ルーティン管理</p>
        </div>

        {/* 方式切替タブ */}
        <div className="flex rounded-xl bg-wabi-surface border border-wabi-border overflow-hidden">
          <button
            onClick={() => { setMethod('password'); setError('') }}
            className={`flex-1 py-2 text-xs cursor-pointer transition-colors ${
              method === 'password' ? 'bg-wabi-accent/20 text-wabi-text font-medium' : 'text-wabi-text-muted'
            }`}
          >
            パスワード
          </button>
          <button
            onClick={() => { setMethod('magic'); setError('') }}
            className={`flex-1 py-2 text-xs cursor-pointer transition-colors ${
              method === 'magic' ? 'bg-wabi-accent/20 text-wabi-text font-medium' : 'text-wabi-text-muted'
            }`}
          >
            マジックリンク
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="メールアドレス"
            required
            className="w-full px-4 py-3 text-sm border border-wabi-border rounded-xl bg-wabi-surface text-wabi-text placeholder:text-wabi-text-muted focus:outline-none focus:border-wabi-accent"
          />

          {method === 'password' && (
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="パスワード"
              required
              minLength={6}
              className="w-full px-4 py-3 text-sm border border-wabi-border rounded-xl bg-wabi-surface text-wabi-text placeholder:text-wabi-text-muted focus:outline-none focus:border-wabi-accent"
            />
          )}

          {error && (
            <p className="text-xs text-wabi-timer">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-sm font-medium bg-wabi-accent/20 text-wabi-text rounded-xl hover:bg-wabi-accent/30 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? '処理中…' : method === 'magic'
              ? 'ログインリンクを送信'
              : mode === 'signup' ? 'アカウント作成' : 'ログイン'}
          </button>
        </form>

        {method === 'password' && (
          <p className="text-xs text-wabi-text-muted text-center">
            {mode === 'login' ? (
              <>アカウントがない？ <button onClick={() => { setMode('signup'); setError('') }} className="text-wabi-accent hover:text-wabi-text cursor-pointer">新規登録</button></>
            ) : (
              <>アカウントがある？ <button onClick={() => { setMode('login'); setError('') }} className="text-wabi-accent hover:text-wabi-text cursor-pointer">ログイン</button></>
            )}
          </p>
        )}

        {method === 'magic' && (
          <p className="text-xs text-wabi-text-muted text-center">
            パスワード不要。メールにログインリンクが届きます。
          </p>
        )}
      </div>
    </div>
  )
}
