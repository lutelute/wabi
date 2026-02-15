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
