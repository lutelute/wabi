import { app, BrowserWindow, ipcMain, Menu, Notification, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import Store from 'electron-store'
import { autoUpdater } from 'electron-updater'
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

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
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

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function escapeYaml(s: string): string {
  if (!s) return '""'
  if (/[:#\[\]{}&*!|>'"%@`,\n]/.test(s) || s.trim() !== s) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return s
}

function buildWabiYaml(date: string, routines: Routine[], executions: Record<string, ExecutionState>): string {
  // 今日のルーティンを探す
  const routine = routines[0] // メインルーティン
  if (!routine) return ''

  const execKey = `${routine.id}:${date}`
  const exec = executions[execKey]
  const dayState = executions[`day:${date}`] as any

  const allItems = routine.phases.flatMap(p => p.items)
  const checkedItems = exec?.checkedItems ?? {}
  const doneCount = Object.values(checkedItems).filter(Boolean).length
  const totalCount = allItems.length
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const lines: string[] = []
  lines.push('wabi:')
  lines.push(`  routine: ${escapeYaml(routine.name)}`)
  lines.push(`  completion: "${doneCount}/${totalCount}"`)
  lines.push(`  completion_pct: ${pct}`)

  // スタミナ・メンタルログ
  if (dayState?.staminaLog?.length > 0) {
    lines.push(`  stamina: [${dayState.staminaLog.map((e: any) => e.level).join(', ')}]`)
  }
  if (dayState?.mentalLog?.length > 0) {
    lines.push(`  mental: [${dayState.mentalLog.map((e: any) => e.level).join(', ')}]`)
  }

  // ムード
  if (dayState?.moodLog?.length > 0) {
    lines.push(`  moods: [${dayState.moodLog.map((e: any) => e.mood).join(', ')}]`)
  }

  // チェックイン
  if (dayState?.checkIns?.length > 0) {
    lines.push('  check_ins:')
    for (const ci of dayState.checkIns) {
      lines.push(`    - time: "${ci.time}"`)
      lines.push(`      stamina: ${ci.stamina}`)
      lines.push(`      mental: ${ci.mental}`)
      if (ci.tags?.length > 0) {
        lines.push(`      tags: [${ci.tags.map((t: string) => escapeYaml(t)).join(', ')}]`)
      }
      if (ci.comment) {
        lines.push(`      comment: ${escapeYaml(ci.comment)}`)
      }
    }
  }

  // 各項目の完了状態
  if (allItems.length > 0) {
    lines.push('  items:')
    for (const item of allItems) {
      lines.push(`    - title: ${escapeYaml(item.title)}`)
      lines.push(`      done: ${!!checkedItems[item.id]}`)
    }
  }

  // やらないと決めたこと
  if (exec?.declined) {
    lines.push(`  declined: ${escapeYaml(exec.declined)}`)
  }

  return lines.join('\n')
}

function writeObsidianDailyNote(date: string): { success: boolean; error?: string } {
  try {
    const settings = store.get('settings' as any) as any ?? {}
    const vaultPath = settings.obsidianVaultPath
    if (!vaultPath) return { success: false, error: 'Vault未設定' }

    const routines = store.get('routines')
    const executions = store.get('executions')
    if (!routines.length) return { success: false, error: 'ルーティン未定義' }

    const wabiYaml = buildWabiYaml(date, routines, executions)
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
    writeObsidianDailyNote(todayString())
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
  return writeObsidianDailyNote(todayString())
})

// ── Auto Updater ──
function setupAutoUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  function sendStatus(text: string) {
    mainWindow?.webContents.send('updater:status', text)
  }

  autoUpdater.on('checking-for-update', () => sendStatus('確認中…'))
  autoUpdater.on('update-available', () => sendStatus('新しいバージョンをダウンロード中…'))
  autoUpdater.on('update-not-available', () => sendStatus('最新バージョンです'))
  autoUpdater.on('error', (err) => sendStatus(`エラー: ${err.message}`))
  autoUpdater.on('download-progress', (info) => {
    sendStatus(`ダウンロード中… ${Math.round(info.percent)}%`)
  })
  autoUpdater.on('update-downloaded', () => {
    sendStatus('ダウンロード完了')
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'アップデート',
      message: '新しいバージョンがダウンロードされました。再起動して適用しますか？',
      buttons: ['再起動', 'あとで'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    })
  })
}

ipcMain.on('updater:check', () => {
  autoUpdater.checkForUpdates()
})

ipcMain.on('updater:install', () => {
  autoUpdater.quitAndInstall()
})

app.whenReady().then(() => {
  restoreFromBackupIfNeeded()
  buildMenu()
  createWindow()

  // パッケージ済みアプリでのみ自動アップデートチェック
  if (app.isPackaged) {
    setupAutoUpdater()
    autoUpdater.checkForUpdates()
  }
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
