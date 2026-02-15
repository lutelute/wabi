import { useState, useEffect, type ReactNode } from 'react'
import { getSupabase, isCloudEnabled } from '../sync/supabaseClient'

type ViewState = 'loading' | 'form' | 'otp-verify' | 'set-password' | 'authenticated'

interface Props {
  children: ReactNode
}

export function AuthGate({ children }: Props) {
  const [state, setState] = useState<ViewState>('loading')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // OTP認証後にパスワード設定画面に進むかどうか
  const [pendingPasswordSet, setPendingPasswordSet] = useState(false)
  const isElectron = !!window.electronAPI

  useEffect(() => {
    if (!isCloudEnabled()) {
      setState('authenticated')
      return
    }

    const supabase = getSupabase()
    if (!supabase) {
      setState('authenticated')
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setState('authenticated')
      } else if (isElectron) {
        setState('authenticated')
      } else {
        setState('form')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // OTP認証成功後、パスワード設定フローなら set-password へ
        if (pendingPasswordSet) {
          setState('set-password')
        } else {
          setState('authenticated')
        }
      } else {
        setState(isElectron ? 'authenticated' : 'form')
      }
    })

    return () => subscription.unsubscribe()
  }, [isElectron, pendingPasswordSet])

  // パスワードログイン
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = getSupabase()
    if (!supabase) return

    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        setError(err.message === 'Invalid login credentials'
          ? 'メールアドレスまたはパスワードが違います'
          : err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // OTPコード送信（ログイン or 新規登録 兼用）
  const handleSendOtp = async (forPasswordSet = false) => {
    setError('')
    if (!email) {
      setError('メールアドレスを入力してください')
      return
    }
    setLoading(true)
    const supabase = getSupabase()
    if (!supabase) return

    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      })
      if (err) { setError(err.message); return }
      setPendingPasswordSet(forPasswordSet)
      setOtpCode('')
      setState('otp-verify')
    } finally {
      setLoading(false)
    }
  }

  // OTP検証
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = getSupabase()
    if (!supabase) return

    try {
      const { error: err } = await supabase.auth.verifyOtp({
        email,
        token: otpCode.trim(),
        type: 'email',
      })
      if (err) {
        setError('コードが正しくありません')
        return
      }
      // pendingPasswordSet の場合は onAuthStateChange で set-password に遷移
    } finally {
      setLoading(false)
    }
  }

  // パスワード設定
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = getSupabase()
    if (!supabase) return

    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword })
      if (err) {
        setError(err.message)
        return
      }
      setPendingPasswordSet(false)
      setState('authenticated')
    } finally {
      setLoading(false)
    }
  }

  if (state === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-wabi-bg">
        <p className="text-sm text-wabi-text-muted">読み込み中...</p>
      </div>
    )
  }

  if (state === 'authenticated') {
    return <>{children}</>
  }

  // パスワード設定画面（OTP認証後）
  if (state === 'set-password') {
    return (
      <div className="h-screen flex items-center justify-center bg-wabi-bg">
        <div className="w-full max-w-sm mx-4 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-lg font-medium text-wabi-text">パスワードを設定</h1>
            <p className="text-sm text-wabi-text-muted">
              <span className="font-medium text-wabi-text">{email}</span> のパスワードを設定します
            </p>
          </div>

          <form onSubmit={handleSetPassword} className="space-y-3">
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="パスワード（6文字以上）"
              required
              minLength={6}
              autoFocus
              className="w-full px-4 py-3 text-sm border border-wabi-border rounded-xl bg-wabi-surface text-wabi-text placeholder:text-wabi-text-muted focus:outline-none focus:border-wabi-accent"
            />

            {error && <p className="text-xs text-wabi-timer">{error}</p>}

            <button
              type="submit"
              disabled={loading || newPassword.length < 6}
              className="w-full py-3 text-sm font-medium bg-wabi-accent/20 text-wabi-text rounded-xl hover:bg-wabi-accent/30 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? '設定中...' : 'パスワードを設定'}
            </button>
          </form>

          <button
            onClick={() => { setPendingPasswordSet(false); setState('authenticated') }}
            className="block mx-auto text-xs text-wabi-text-muted hover:text-wabi-text cursor-pointer"
          >
            スキップ（パスワードなしで続行）
          </button>
        </div>
      </div>
    )
  }

  // OTPコード入力画面
  if (state === 'otp-verify') {
    return (
      <div className="h-screen flex items-center justify-center bg-wabi-bg">
        <div className="w-full max-w-sm mx-4 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-lg font-medium text-wabi-text">認証コードを入力</h1>
            <p className="text-sm text-wabi-text-muted">
              <span className="font-medium text-wabi-text">{email}</span> に送信された6桁のコードを入力してください
            </p>
            {pendingPasswordSet && (
              <p className="text-xs text-wabi-accent">本人確認後にパスワードを設定します</p>
            )}
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              autoFocus
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="6桁の認証コード"
              required
              maxLength={8}
              className="w-full px-4 py-3 text-sm text-center tracking-[0.5em] font-mono border border-wabi-border rounded-xl bg-wabi-surface text-wabi-text placeholder:text-wabi-text-muted placeholder:tracking-normal focus:outline-none focus:border-wabi-accent"
            />

            {error && <p className="text-xs text-wabi-timer">{error}</p>}

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              className="w-full py-3 text-sm font-medium bg-wabi-accent/20 text-wabi-text rounded-xl hover:bg-wabi-accent/30 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? '確認中...' : '確認'}
            </button>
          </form>

          <button
            onClick={() => { setState('form'); setOtpCode(''); setError(''); setPendingPasswordSet(false) }}
            className="block mx-auto text-xs text-wabi-accent hover:text-wabi-text cursor-pointer"
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  // ログインフォーム
  return (
    <div className="h-screen flex items-center justify-center bg-wabi-bg">
      <div className="w-full max-w-sm mx-4 space-y-5">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-medium text-wabi-text">侘び</h1>
          <p className="text-sm text-wabi-text-muted">ルーティン管理</p>
        </div>

        {/* パスワードログイン */}
        <form onSubmit={handlePasswordLogin} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="メールアドレス"
            required
            className="w-full px-4 py-3 text-sm border border-wabi-border rounded-xl bg-wabi-surface text-wabi-text placeholder:text-wabi-text-muted focus:outline-none focus:border-wabi-accent"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="パスワード"
            required
            minLength={6}
            className="w-full px-4 py-3 text-sm border border-wabi-border rounded-xl bg-wabi-surface text-wabi-text placeholder:text-wabi-text-muted focus:outline-none focus:border-wabi-accent"
          />

          {error && <p className="text-xs text-wabi-timer">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-sm font-medium bg-wabi-accent/20 text-wabi-text rounded-xl hover:bg-wabi-accent/30 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? '処理中...' : 'ログイン'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-wabi-border/50" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-wabi-bg px-3 text-[10px] text-wabi-text-muted">または</span>
          </div>
        </div>

        {/* 認証コードでログイン */}
        <button
          onClick={() => handleSendOtp(false)}
          disabled={loading || !email}
          className="w-full py-3 text-sm font-medium border border-wabi-border text-wabi-text rounded-xl hover:bg-wabi-surface transition-colors cursor-pointer disabled:opacity-50"
        >
          認証コードでログイン
        </button>

        <p className="text-xs text-wabi-text-muted text-center">
          メールに届く6桁のコードでログインします。アカウントがなければ自動作成されます。
        </p>

        {/* パスワード設定/変更 */}
        <p className="text-xs text-wabi-text-muted text-center">
          <button
            onClick={() => handleSendOtp(true)}
            disabled={loading || !email}
            className="text-wabi-accent hover:text-wabi-text cursor-pointer disabled:opacity-50"
          >
            パスワードを設定/変更
          </button>
        </p>

        {/* Electron: スキップ可能 */}
        {isElectron && (
          <button
            onClick={() => setState('authenticated')}
            className="block mx-auto text-xs text-wabi-text-muted hover:text-wabi-text cursor-pointer"
          >
            スキップ（ローカルのみ）
          </button>
        )}
      </div>
    </div>
  )
}
