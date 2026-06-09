/**
 * wabi Local API — 対話レイヤーの受け口（L0）
 *
 * 127.0.0.1 限定の小型HTTPサーバー。Claude Code(wabi-mcp)や将来のアプリ内チャットが
 * ここを叩くと、main→renderer の往復を経て正規ストレージ（保存・同期・Obsidian・庭）に
 * 反映される。書き込みは必ずレンダラーの正規Context関数を通す（mainがstoreを直書きしない）。
 *
 * - Bearer token 必須（wabi-api.json に保存、0600）
 * - Host header 検証（DNS rebinding対策）
 * - mainがstoreを書かないので、レンダラーのメモリ状態と乖離しない
 */
import http from 'http'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export interface LocalApiDeps {
  /** main→renderer 往復。actionとpayloadを渡し、処理結果を返す */
  handle: (action: string, payload: unknown) => Promise<unknown>
  /** レンダラーが応答できる状態か（ウィンドウ生存 & ロード済み） */
  isReady: () => boolean
  appVersion: string
}

export interface LocalApiHandle {
  port: number
  token: string
  close: () => void
  tokenFilePath: string
}

const PORT_START = 51722
const PORT_TRIES = 12

interface Route {
  method: 'GET' | 'POST'
  // パスは前方一致でなく完全一致（クエリは別途）
  path: string
  action: string
  // POSTのbodyを payload に。GETはクエリを payload に
}

const ROUTES: Route[] = [
  { method: 'GET', path: '/api/today', action: 'today' },
  { method: 'GET', path: '/api/recent', action: 'recent' },
  { method: 'POST', path: '/api/checkin', action: 'checkin' },
  { method: 'POST', path: '/api/mood', action: 'mood' },
  { method: 'POST', path: '/api/note', action: 'note' },
  { method: 'POST', path: '/api/declined', action: 'declined' },
  { method: 'POST', path: '/api/action-check', action: 'action-check' },
]

function hostAllowed(host: string | undefined, port: number): boolean {
  if (!host) return false
  // 127.0.0.1:port / localhost:port のみ許可
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`
}

function readBody(req: http.IncomingMessage, limit = 64 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    let size = 0
    req.on('data', chunk => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      data += chunk
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export async function startLocalApi(userDataPath: string, deps: LocalApiDeps): Promise<LocalApiHandle> {
  const token = crypto.randomBytes(24).toString('hex')
  const tokenFilePath = path.join(userDataPath, 'wabi-api.json')

  const server = http.createServer(async (req, res) => {
    const send = (status: number, obj: unknown) => {
      if (res.writableEnded || res.destroyed) return  // 二重送出・破壊後の書き込みを防ぐ
      const body = JSON.stringify(obj)
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      res.end(body)
    }

    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`)
      const port = (server.address() as { port: number } | null)?.port ?? PORT_START

      // ブラウザ由来（Originあり）は拒否。MCP/curl/undici はOriginを送らない
      if (req.headers.origin) {
        return send(403, { error: 'forbidden origin' })
      }
      // Host検証（DNS rebinding対策）
      if (!hostAllowed(req.headers.host, port)) {
        return send(403, { error: 'forbidden host' })
      }

      // health は token不要（起動確認用）
      if (req.method === 'GET' && url.pathname === '/api/health') {
        return send(200, { ok: true, app: 'wabi', version: deps.appVersion, ready: deps.isReady() })
      }

      // token検証
      const auth = req.headers['authorization'] || ''
      const provided = auth.startsWith('Bearer ') ? auth.slice(7) : ''
      if (provided !== token) {
        return send(401, { error: 'unauthorized' })
      }

      const route = ROUTES.find(r => r.method === req.method && r.path === url.pathname)
      if (!route) {
        return send(404, { error: 'not found' })
      }

      if (!deps.isReady()) {
        return send(503, { error: 'wabi window not ready', ready: false })
      }

      let payload: unknown
      if (req.method === 'POST') {
        const raw = await readBody(req)
        payload = raw ? JSON.parse(raw) : {}
      } else {
        payload = Object.fromEntries(url.searchParams.entries())
      }

      const data = await deps.handle(route.action, payload)
      return send(200, { ok: true, data })
    } catch (e: any) {
      return send(500, { error: e?.message || String(e) })
    }
  })

  const port = await listenWithFallback(server, PORT_START, PORT_TRIES)

  // 稼働中の予期せぬエラーで main プロセスを落とさない
  server.on('error', (e) => console.error('[wabi] local API runtime error:', e))

  // wabi-api.json 書き出し（MCP/外部がこれを読んで接続）
  fs.writeFileSync(
    tokenFilePath,
    JSON.stringify({ port, token, pid: process.pid, startedAt: new Date().toISOString() }, null, 2),
    { mode: 0o600 },
  )

  return {
    port,
    token,
    tokenFilePath,
    close: () => {
      try { server.close() } catch { /* ignore */ }
      try { if (fs.existsSync(tokenFilePath)) fs.unlinkSync(tokenFilePath) } catch { /* ignore */ }
    },
  }
}

function listenWithFallback(server: http.Server, startPort: number, tries: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let attempt = 0
    const tryPort = (port: number) => {
      const onError = (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && attempt < tries - 1) {
          attempt++
          tryPort(startPort + attempt)
        } else {
          reject(err)
        }
      }
      server.once('error', onError)
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', onError)
        resolve(port)
      })
    }
    tryPort(startPort)
  })
}
