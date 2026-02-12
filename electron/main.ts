import { app, BrowserWindow, ipcMain, Menu, Notification } from 'electron'
import path from 'path'
import Store from 'electron-store'
import type { Routine, ExecutionState } from '../src/types/routine'

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
  store.set('routines', routines)
  return true
})

ipcMain.handle('store:getExecution', (_event, key: string) => {
  const executions = store.get('executions')
  return executions[key] || null
})

ipcMain.handle('store:saveExecution', (_event, key: string, state: ExecutionState) => {
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
  store.set('settings' as any, settings)
  return true
})

// Clear execution data
ipcMain.handle('store:clearExecutions', () => {
  store.set('executions', {})
  return true
})

app.whenReady().then(() => {
  buildMenu()
  createWindow()
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
