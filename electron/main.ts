import { app, BrowserWindow, ipcMain, Menu, Notification, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import Store from 'electron-store'
import { autoUpdater } from 'electron-updater'
import { wabiToday } from '../src/utils/wabiDate'
import { startLocalApi, type LocalApiHandle } from './localApi'
import type { Routine, ExecutionState, BackupData } from '../src/types/routine'

interface StoreSchema {
  routines: Routine[]
  executions: Record<string, ExecutionState>
}

const store = new Store<StoreSchema>({
  defaults: {
    routines: [],
    executions: {},
  },
})

// ── Backup Rotation ──
let lastDataHash = ''

function computeHash(data: unknown): string {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')
}

function getStorePath(): string {
  return (store as any).path as string
}

function getPrevPath(): string {
  const p = getStorePath()
  return p.replace(/\.json$/, '.prev.json')
}

function rotateBackup(): void {
  try {
    const currentData = { routines: store.get('routines'), executions: store.get('executions') }
    const hash = computeHash(currentData)
    if (hash === lastDataHash) return // 差分なし → スキップ

    const storePath = getStorePath()
    const prevPath = getPrevPath()
    if (fs.existsSync(storePath)) {
      fs.copyFileSync(storePath, prevPath)
    }
    lastDataHash = hash
  } catch (e) {
    console.error('[wabi] backup rotation failed:', e)
  }
}

function restoreFromBackupIfNeeded(): void {
  try {
    const routines = store.get('routines')
    const executions = store.get('executions')
    // 空データ検出: ルーティンもexecutionsも空
    const isEmpty = (!routines || routines.length === 0) &&
                    (!executions || Object.keys(executions).length === 0)

    if (!isEmpty) {
      lastDataHash = computeHash({ routines, executions })
      return
    }

    const prevPath = getPrevPath()
    if (!fs.existsSync(prevPath)) return

    const raw = fs.readFileSync(prevPath, 'utf-8')
    const prev = JSON.parse(raw)
    if (prev.routines && prev.routines.length > 0) {
      store.set('routines', prev.routines)
      console.log('[wabi] restored routines from backup')
    }
    if (prev.executions && Object.keys(prev.executions).length > 0) {
      store.set('executions', prev.executions)
      console.log('[wabi] restored executions from backup')
    }
    lastDataHash = computeHash({ routines: store.get('routines'), executions: store.get('executions') })
  } catch (e) {
    console.error('[wabi] restore from backup failed:', e)
  }
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#faf8f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // リロード/遷移時、応答待ちのexternalリクエストを解放
  mainWindow.webContents.on('did-start-navigation', () => rejectAllPending('window navigated'))

  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  mainWindow.setTitle(devServerUrl ? '侘び [DEV]' : '侘び')

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// IPC Handlers
ipcMain.handle('store:getRoutines', () => {
  return store.get('routines')
})

ipcMain.handle('store:saveRoutines', (_event, routines: Routine[]) => {
  rotateBackup()
  store.set('routines', routines)
  return true
})

ipcMain.handle('store:getExecution', (_event, key: string) => {
  const executions = store.get('executions')
  return executions[key] || null
})

ipcMain.handle('store:saveExecution', (_event, key: string, state: ExecutionState) => {
  rotateBackup()
  const executions = store.get('executions')
  executions[key] = state
  store.set('executions', executions)
  scheduleObsidianExport()
  return true
})

ipcMain.handle('notification:show', (_event, title: string, body: string) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
  return true
})

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: `${app.name} について` },
        { type: 'separator' },
        {
          label: '設定…',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow?.webContents.send('open-settings'),
        },
        { type: 'separator' },
        { role: 'hide', label: `${app.name} を隠す` },
        { role: 'hideOthers', label: 'ほかを隠す' },
        { role: 'unhide', label: 'すべてを表示' },
        { type: 'separator' },
        { role: 'quit', label: `${app.name} を終了` },
      ],
    },
    {
      label: '編集',
      submenu: [
        { role: 'undo', label: '取り消す' },
        { role: 'redo', label: 'やり直す' },
        { type: 'separator' },
        { role: 'cut', label: 'カット' },
        { role: 'copy', label: 'コピー' },
        { role: 'paste', label: 'ペースト' },
        { role: 'selectAll', label: 'すべてを選択' },
      ],
    },
    {
      label: 'ウインドウ',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: 'ズーム' },
        { role: 'close', label: '閉じる' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// Settings store
ipcMain.handle('settings:get', () => {
  return store.get('settings' as any) ?? {}
})

ipcMain.handle('settings:save', (_event, settings: Record<string, unknown>) => {
  rotateBackup()
  store.set('settings' as any, settings)
  return true
})

// Clear execution data
ipcMain.handle('store:clearExecutions', () => {
  store.set('executions', {})
  return true
})

// ── Backup Export / Import ──
ipcMain.handle('backup:export', async () => {
  try {
    const backupData: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      routines: store.get('routines'),
      executions: store.get('executions'),
      settings: store.get('settings' as any) ?? {},
    }
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
      title: 'バックアップをエクスポート',
      defaultPath: `wabi-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (canceled || !filePath) return { success: false }
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8')
    return { success: true, path: filePath }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('backup:import', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
      title: 'バックアップをインポート',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return { success: false }

    const raw = fs.readFileSync(filePaths[0], 'utf-8')
    const data = JSON.parse(raw) as BackupData

    // バリデーション
    if (!data.version || !data.routines || !data.executions) {
      return { success: false, error: '無効なバックアップファイルです' }
    }

    const { response } = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      title: 'バックアップの復元',
      message: `${data.exportedAt.slice(0, 10)} のバックアップを復元しますか？\n現在のデータは上書きされます。`,
      buttons: ['復元する', 'キャンセル'],
      defaultId: 1,
    })
    if (response !== 0) return { success: false }

    rotateBackup()
    store.set('routines', data.routines)
    store.set('executions', data.executions)
    if (data.settings) store.set('settings' as any, data.settings)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

// ── Obsidian Integration ──

function escapeYaml(s: string): string {
  if (!s) return '""'
  if (/[:#\[\]{}&*!|>'"%@`,\n]/.test(s) || s.trim() !== s) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return s
}

function buildWabiYaml(date: string, executions: Record<string, ExecutionState>): string {
  // 現行データモデル: アクションリスト (actions:{date}) + 日の状態 (day:{date})
  const actionState = executions[`actions:${date}`] as any
  const dayState = executions[`day:${date}`] as any

  const actions: any[] = actionState?.actions ?? []
  const checkedItems: Record<string, boolean> = actionState?.checkedItems ?? {}
  const doneCount = actions.filter(a => checkedItems[a.id]).length
  const totalCount = actions.length
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  if (totalCount === 0 && !dayState) return ''

  const lines: string[] = []
  lines.push('wabi:')

  // 今日のアクションの出どころ（複数ルーティン対応）
  const routineNames = [...new Set(actions.map(a => a.sourceRoutineName).filter(Boolean))]
  if (routineNames.length > 0) {
    lines.push(`  routines: [${routineNames.map(n => escapeYaml(String(n))).join(', ')}]`)
  }
  lines.push(`  completion: "${doneCount}/${totalCount}"`)
  lines.push(`  completion_pct: ${pct}`)

  // 4軸ログ（mental=淀, wave=波, body_temp=体温）
  if (dayState?.staminaLog?.length > 0) {
    lines.push(`  stamina: [${dayState.staminaLog.map((e: any) => e.level).join(', ')}]`)
  }
  if (dayState?.mentalLog?.length > 0) {
    lines.push(`  mental: [${dayState.mentalLog.map((e: any) => e.level).join(', ')}]`)
  }
  if (dayState?.waveLog?.length > 0) {
    lines.push(`  wave: [${dayState.waveLog.map((e: any) => e.level).join(', ')}]`)
  }
  if (dayState?.bodyTempLog?.length > 0) {
    lines.push(`  body_temp: [${dayState.bodyTempLog.map((e: any) => e.level).join(', ')}]`)
  }

  // ムード
  if (dayState?.moodLog?.length > 0) {
    lines.push(`  moods: [${dayState.moodLog.map((e: any) => e.mood).join(', ')}]`)
  }

  // チェックイン（4軸）
  if (dayState?.checkIns?.length > 0) {
    lines.push('  check_ins:')
    for (const ci of dayState.checkIns) {
      lines.push(`    - time: "${ci.time}"`)
      lines.push(`      stamina: ${ci.stamina}`)
      lines.push(`      mental: ${ci.mental}`)
      if (ci.wave != null) lines.push(`      wave: ${ci.wave}`)
      if (ci.bodyTemp != null) lines.push(`      body_temp: ${ci.bodyTemp}`)
      if (ci.tags?.length > 0) {
        lines.push(`      tags: [${ci.tags.map((t: string) => escapeYaml(t)).join(', ')}]`)
      }
      if (ci.comment) {
        lines.push(`      comment: ${escapeYaml(ci.comment)}`)
      }
    }
  }

  // 各アクションの完了状態・気持ち・ひとこと
  if (actions.length > 0) {
    lines.push('  items:')
    for (const a of actions) {
      lines.push(`    - title: ${escapeYaml(a.title)}`)
      lines.push(`      done: ${!!checkedItems[a.id]}`)
      const mood = actionState?.itemMoods?.[a.id]
      if (mood) lines.push(`      mood: ${mood}`)
      const comment = actionState?.itemComments?.[a.id]
      if (comment) lines.push(`      comment: ${escapeYaml(String(comment))}`)
    }
  }

  // やらないと決めたこと
  if (actionState?.declined) {
    lines.push(`  declined: ${escapeYaml(String(actionState.declined))}`)
  }

  return lines.join('\n')
}

function writeObsidianDailyNote(date: string): { success: boolean; error?: string } {
  try {
    const settings = store.get('settings' as any) as any ?? {}
    const vaultPath = settings.obsidianVaultPath
    if (!vaultPath) return { success: false, error: 'Vault未設定' }

    const executions = store.get('executions')

    const wabiYaml = buildWabiYaml(date, executions)
    if (!wabiYaml) return { success: false, error: 'データなし' }

    // デイリーノート内容
    const dayState = executions[`day:${date}`] as any
    const dailyNotes = dayState?.dailyNotes || ''

    const filePath = path.join(vaultPath, `${date}.md`)

    let content = ''
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf-8')
    }

    // フロントマターを解析・更新
    const fmRegex = /^---\n([\s\S]*?)\n---/
    const match = content.match(fmRegex)

    let frontmatterBody = ''
    let body = ''

    if (match) {
      // 既存のフロントマターからwabiブロックを除去
      const existingFm = match[1]
      const fmLines = existingFm.split('\n')
      const nonWabiLines: string[] = []
      let inWabi = false
      for (const line of fmLines) {
        if (line.startsWith('wabi:')) {
          inWabi = true
          continue
        }
        if (inWabi && (line.startsWith('  ') || line.startsWith('\t'))) {
          continue // wabiの子行をスキップ
        }
        inWabi = false
        nonWabiLines.push(line)
      }
      frontmatterBody = nonWabiLines.filter(l => l.trim()).join('\n')
      body = content.slice(match[0].length).replace(/^\n+/, '')
    } else {
      body = content
    }

    // wabiセクションを追加
    const fmParts = [frontmatterBody, wabiYaml].filter(Boolean)
    const newFrontmatter = fmParts.join('\n')

    // body内のwabiデイリーノートを更新
    const wabiBodyRegex = /<!-- wabi:start -->[\s\S]*?<!-- wabi:end -->/
    const wabiBody = dailyNotes
      ? `<!-- wabi:start -->\n## wabi\n${dailyNotes}\n<!-- wabi:end -->`
      : ''

    if (wabiBodyRegex.test(body)) {
      body = body.replace(wabiBodyRegex, wabiBody).trim()
    } else if (wabiBody) {
      body = body ? `${body}\n\n${wabiBody}` : wabiBody
    }

    const output = `---\n${newFrontmatter}\n---\n${body ? '\n' + body + '\n' : '\n'}`

    // ディレクトリ確認
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(filePath, output, 'utf-8')
    return { success: true }
  } catch (e: any) {
    console.error('[wabi] obsidian export failed:', e)
    return { success: false, error: e.message }
  }
}

// デバウンスされた自動エクスポート
let obsidianExportTimer: ReturnType<typeof setTimeout> | null = null
function scheduleObsidianExport() {
  const settings = store.get('settings' as any) as any ?? {}
  if (!settings.obsidianVaultPath) return
  if (obsidianExportTimer) clearTimeout(obsidianExportTimer)
  obsidianExportTimer = setTimeout(() => {
    writeObsidianDailyNote(wabiToday())
  }, 3000) // 3秒デバウンス
}

ipcMain.handle('obsidian:selectVault', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    title: 'Obsidian デイリーノートフォルダを選択',
    properties: ['openDirectory'],
  })
  if (canceled || filePaths.length === 0) return null
  return filePaths[0]
})

ipcMain.handle('obsidian:export', () => {
  return writeObsidianDailyNote(wabiToday())
})

// ── Auto Updater (自動ダウンロード + インストール) ──
function setupAutoUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  function sendStatus(text: string) {
    mainWindow?.webContents.send('updater:status', text)
  }

  autoUpdater.on('checking-for-update', () => sendStatus('確認中…'))
  autoUpdater.on('update-available', (info) => {
    sendStatus(`v${info.version} をダウンロード中…`)
    mainWindow?.webContents.send('updater:new-version', info.version)
  })
  autoUpdater.on('update-not-available', () => sendStatus('最新バージョンです'))
  autoUpdater.on('error', (err) => {
    console.error('[wabi] updater error:', err)
    sendStatus('更新の確認に失敗しました')
  })
  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater:download-progress', Math.round(progress.percent))
  })
  autoUpdater.on('update-downloaded', (info) => {
    sendStatus(`v${info.version} インストール準備完了`)
    mainWindow?.webContents.send('updater:ready', info.version)
  })
}

ipcMain.on('updater:check', () => {
  autoUpdater.checkForUpdates()
})

ipcMain.on('updater:install', () => {
  autoUpdater.quitAndInstall()
})

// ── Local API（対話レイヤーの受け口）──
let localApi: LocalApiHandle | null = null

// main→renderer のリクエストID往復管理
const pendingExternal = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

function callRenderer(action: string, payload: unknown, timeoutMs = 8000): Promise<unknown> {
  if (!mainWindow || mainWindow.webContents.isLoading()) {
    return Promise.reject(new Error('window not ready'))
  }
  const id = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    pendingExternal.set(id, { resolve, reject })
    mainWindow!.webContents.send('external:request', { id, action, payload })
    setTimeout(() => {
      if (pendingExternal.has(id)) {
        pendingExternal.delete(id)
        reject(new Error('renderer response timeout'))
      }
    }, timeoutMs)
  })
}

ipcMain.on('external:response', (_e, resp: { id: string; ok: boolean; data?: unknown; error?: string }) => {
  const p = pendingExternal.get(resp.id)
  if (!p) return
  pendingExternal.delete(resp.id)
  if (resp.ok) p.resolve(resp.data)
  else p.reject(new Error(resp.error || 'renderer error'))
})

// ウィンドウのリロード/遷移で応答待ちを即解放（8秒timeoutを待たずに失敗させる）
function rejectAllPending(reason: string) {
  for (const [, p] of pendingExternal) p.reject(new Error(reason))
  pendingExternal.clear()
}

async function setupLocalApi() {
  try {
    localApi = await startLocalApi(app.getPath('userData'), {
      handle: callRenderer,
      isReady: () => !!mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoading(),
      appVersion: app.getVersion(),
    })
    console.log(`[wabi] local API on 127.0.0.1:${localApi.port}`)
  } catch (e) {
    console.error('[wabi] local API failed to start:', e)
  }
}

app.whenReady().then(() => {
  restoreFromBackupIfNeeded()
  buildMenu()
  createWindow()
  setupLocalApi()

  // パッケージ済みアプリでのみ自動アップデートチェック
  if (app.isPackaged) {
    setupAutoUpdater()
    autoUpdater.checkForUpdates()
  }
})

app.on('will-quit', () => {
  localApi?.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
