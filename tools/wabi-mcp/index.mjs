#!/usr/bin/env node
/**
 * wabi-mcp — wabi 対話レイヤーの MCP サーバー（L1）
 *
 * 依存ゼロ。生の JSON-RPC over stdio で MCP プロトコルを話す。
 * wabi アプリ（Electron）が書き出す wabi-api.json を読んで Local API に接続し、
 * 会話から推定したチェックイン等を wabi に記録する。
 *
 * 登録例:
 *   claude mcp add wabi -s user -- node /path/to/wabi/tools/wabi-mcp/index.mjs
 *
 * 環境変数:
 *   WABI_API_FILE  wabi-api.json の明示パス（開発用。未指定なら標準の userData を探す）
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'

// ── wabi-api.json の場所を解決 ──
function apiFileCandidates() {
  if (process.env.WABI_API_FILE) return [process.env.WABI_API_FILE]
  const home = os.homedir()
  if (process.platform === 'darwin') {
    return [path.join(home, 'Library', 'Application Support', 'wabi', 'wabi-api.json')]
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
    return [path.join(appData, 'wabi', 'wabi-api.json')]
  }
  // linux
  const config = process.env.XDG_CONFIG_HOME || path.join(home, '.config')
  return [path.join(config, 'wabi', 'wabi-api.json')]
}

function readApiConfig() {
  for (const p of apiFileCandidates()) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf-8'))
      }
    } catch { /* try next */ }
  }
  return null
}

async function wabiFetch(method, apiPath, body) {
  const cfg = readApiConfig()
  if (!cfg) {
    throw new Error('wabiアプリが起動していないようです。wabiを起動してから、もう一度話しかけてください。')
  }
  const url = `http://127.0.0.1:${cfg.port}${apiPath}`
  let res
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('wabiに接続できませんでした。アプリが起動しているか確認してください。')
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || `wabi API error (${res.status})`)
  }
  return json.data
}

// ── ツール定義 ──
const TOOLS = [
  {
    name: 'wabi_get_context',
    description: '対話を始める前に必ず呼ぶ。wabiに記録された今日と直近数日の状態（チェックイン・気分・ほどき・休息・手放したこと）を返す。昨日までの流れを踏まえて声をかけるために使う。',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: '遡る日数（既定7、1-31）' },
      },
    },
  },
  {
    name: 'wabi_checkin',
    description: '体と心の状態を4軸で記録する。各軸0-100。会話から推定した値を、必ずユーザーに確認してから呼ぶこと。stamina=体力(尽0↔満100。高いほど残っている), mental=淀(濁0↔澄100。高いほど頭がクリア), wave=波(凪0↔荒100。高いほどざわつく), bodyTemp=体温(冷0↔熱100)。',
    inputSchema: {
      type: 'object',
      properties: {
        stamina: { type: 'number', description: '体力 0-100（高い=残っている）' },
        mental: { type: 'number', description: '淀 0-100（高い=澄んでいる）' },
        wave: { type: 'number', description: '波 0-100（高い=ざわつく）' },
        bodyTemp: { type: 'number', description: '体温 0-100' },
        tags: { type: 'array', items: { type: 'string' }, description: '気持ちタグ（例: 疲れた, すっきり）' },
        comment: { type: 'string', description: 'ひとことメモ（任意）' },
      },
      required: ['stamina', 'mental', 'wave', 'bodyTemp'],
    },
  },
  {
    name: 'wabi_mood',
    description: '今の気分を5段階で記録する。heavy(重い)/cloudy(もやもや)/flat(ふつう)/calm(穏やか)/light(軽い)。',
    inputSchema: {
      type: 'object',
      properties: {
        mood: { type: 'string', enum: ['heavy', 'cloudy', 'flat', 'calm', 'light'] },
      },
      required: ['mood'],
    },
  },
  {
    name: 'wabi_note',
    description: '今日の「心のメモ」に書き留める。対話で出てきた気づきや手放したことを短くまとめて残すのに使う。',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        mode: { type: 'string', enum: ['append', 'replace'], description: '既定append（追記）' },
      },
      required: ['text'],
    },
  },
  {
    name: 'wabi_declined',
    description: '「今日やらないと決めたこと」を記録する。やらない選択を決断として残す。',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        mode: { type: 'string', enum: ['append', 'replace'], description: '既定append' },
      },
      required: ['text'],
    },
  },
  {
    name: 'wabi_action_check',
    description: '今日のアクションリストの項目を、タイトル一致で完了にする。「あれ終わった」という発言を拾ったときに使う。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'アクションのタイトル（部分一致可）' },
      },
      required: ['title'],
    },
  },
]

const TOOL_IMPL = {
  wabi_get_context: (args) => wabiFetch('GET', `/api/recent?days=${args?.days ?? 7}`),
  wabi_checkin: (args) => wabiFetch('POST', '/api/checkin', args),
  wabi_mood: (args) => wabiFetch('POST', '/api/mood', args),
  wabi_note: (args) => wabiFetch('POST', '/api/note', args),
  wabi_declined: (args) => wabiFetch('POST', '/api/declined', args),
  wabi_action_check: (args) => wabiFetch('POST', '/api/action-check', args),
}

// ── JSON-RPC over stdio ──
function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}
function respond(id, result) {
  send({ jsonrpc: '2.0', id, result })
}
function respondError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

const rl = readline.createInterface({ input: process.stdin })

rl.on('line', async (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let msg
  try {
    msg = JSON.parse(trimmed)
  } catch {
    return // 不正な行は無視
  }

  const { id, method, params } = msg

  // 通知（idなし）には応答しない
  if (id === undefined || id === null) {
    return
  }

  try {
    if (method === 'initialize') {
      // 自分がサポートするバージョンを返す（クライアントのエコーバックはしない）
      respond(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'wabi', version: '1.0.0' },
      })
    } else if (method === 'tools/list') {
      respond(id, { tools: TOOLS })
    } else if (method === 'tools/call') {
      const name = params?.name
      const args = params?.arguments || {}
      const impl = TOOL_IMPL[name]
      if (!impl) {
        // 未知ツールは protocol error ではなく isError result（クライアントが会話を続けられる）
        respond(id, { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true })
        return
      }
      try {
        const data = await impl(args)
        respond(id, {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        })
      } catch (e) {
        // ツール実行エラーは isError で返す（LLMが読んで対処できる）
        respond(id, {
          content: [{ type: 'text', text: e?.message || String(e) }],
          isError: true,
        })
      }
    } else if (method === 'ping') {
      respond(id, {})
    } else {
      respondError(id, -32601, `method not found: ${method}`)
    }
  } catch (e) {
    respondError(id, -32603, e?.message || String(e))
  }
})
