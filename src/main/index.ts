// ============================================================
// Main Process - Uygulama giriş noktası
// Temiz tutulur: Yaşam döngüsü yönetimi ve pencere oluşturma.
// Servisler ServiceManager üzerinden kayıt edilir.
// Splash: Ayrı bir pencerede açılır; backend hazır olunca kapanır,
// ana uygulama penceresi açılır.
// ============================================================

import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Core
import { Logger } from './core/Logger'
import { ServiceManager } from './core/ServiceManager'
import { Database } from './database/Database'

// Modüller
import { AuthService } from './modules/auth/auth.service'

import type { LoadingProgressPayload } from '@shared/types'

const logger = Logger.getInstance()

/** IPC kanal adları - uygulama yaşam döngüsü */
const APP_LOADING_PROGRESS = 'app:loading-progress'
const APP_BACKEND_READY = 'app:backend-ready'

/** Adımlar arası bekleme süresi (ms); kullanıcı her adımı görebilsin diye */
const STEP_DELAY_MS = 400

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Renderer'a yükleme adımı gönderir */
function sendProgress(win: BrowserWindow, payload: LoadingProgressPayload): void {
  if (!win.isDestroyed()) {
    win.webContents.send(APP_LOADING_PROGRESS, payload)
  }
}

/** Backend'i adım adım başlatır; her adım arasında bekleme vardır, ilerleme splash'e gönderilir */
async function runBackendInit(splashWindow: BrowserWindow): Promise<ServiceManager> {
  sendProgress(splashWindow, {
    step: 'app',
    message: 'Uygulama başlatılıyor...',
    status: 'started'
  })
  await delay(STEP_DELAY_MS)

  sendProgress(splashWindow, {
    step: 'database',
    message: 'Veritabanı başlatılıyor...',
    status: 'started'
  })
  await delay(STEP_DELAY_MS)
  Database.getInstance()
  sendProgress(splashWindow, {
    step: 'database',
    message: 'Veritabanı hazır',
    status: 'done'
  })
  await delay(STEP_DELAY_MS)

  sendProgress(splashWindow, {
    step: 'services',
    message: 'Servisler başlatılıyor...',
    status: 'started'
  })
  await delay(STEP_DELAY_MS)

  const serviceManager = new ServiceManager()
  serviceManager.register(new AuthService())
  serviceManager.initialize((moduleName) => {
    sendProgress(splashWindow, {
      step: 'service',
      message: `${moduleName} modülü yüklendi`,
      status: 'done'
    })
  })
  await delay(STEP_DELAY_MS)

  sendProgress(splashWindow, {
    step: 'services',
    message: 'Tüm servisler hazır',
    status: 'done'
  })
  await delay(STEP_DELAY_MS)

  if (!splashWindow.isDestroyed()) {
    splashWindow.webContents.send(APP_BACKEND_READY)
  }
  return serviceManager
}

let serviceManagerRef: ServiceManager | null = null
/** Ana uygulama penceresi referansı — frameless pencerede min/max/close IPC için */
let mainWindowRef: BrowserWindow | null = null

/** Splash penceresini yüklemek için kullanılacak dosya yolu (dev'de kaynak, prod'da build) */
function getSplashPath(): string {
  if (is.dev) {
    return join(app.getAppPath(), 'src/renderer/splash.html')
  }
  return join(__dirname, '../renderer/splash.html')
}

/** Backend başlatıp ana pencereyi açar; splash yüklendikten veya hata sonrası çağrılır */
async function onSplashReady(splashWindow: BrowserWindow): Promise<void> {
  if (splashWindow.isDestroyed()) return
  const SPLASH_PAINT_DELAY_MS = 200
  await delay(SPLASH_PAINT_DELAY_MS)
  if (splashWindow.isDestroyed()) return
  serviceManagerRef = await runBackendInit(splashWindow)
  createMainWindow(splashWindow)
}

/** Splash penceresini oluşturur; yüklendikten sonra backend başlatır, ardından ana pencereyi açar */
function createSplashWindow(): void {
  const splashWindow = new BrowserWindow({
    width: 520,
    height: 260,
    minWidth: 440,
    minHeight: 220,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  splashWindow.loadFile(getSplashPath()).catch((err) => {
    logger.error('Splash yüklenemedi', err, 'Main')
    splashWindow.show()
    onSplashReady(splashWindow)
  })

  let showFallback: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    showFallback = null
    if (!splashWindow.isDestroyed() && !splashWindow.isVisible()) {
      splashWindow.show()
    }
  }, 600)

  splashWindow.once('ready-to-show', () => {
    if (showFallback) {
      clearTimeout(showFallback)
      showFallback = null
    }
    splashWindow.show()
  })

  splashWindow.webContents.once('did-finish-load', () => {
    if (showFallback) {
      clearTimeout(showFallback)
      showFallback = null
    }
    void onSplashReady(splashWindow)
  })

  splashWindow.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
    logger.error(`Splash load hatası: ${errorCode} ${errorDescription}`, undefined, 'Main')
    if (showFallback) {
      clearTimeout(showFallback)
      showFallback = null
    }
    if (!splashWindow.isDestroyed()) {
      splashWindow.show()
      onSplashReady(splashWindow)
    }
  })
}

/** Ana uygulama penceresini oluşturur; yüklendiğinde splash kapatılır. Title bar yok, header title bar gibi davranır. */
function createMainWindow(splashWindowToClose?: BrowserWindow): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindowRef = mainWindow
  mainWindow.on('closed', () => {
    mainWindowRef = null
  })
  mainWindow.on('maximize', () => {
    if (!mainWindow.isDestroyed())
      mainWindow.webContents.send('app:window-state-changed', { isMaximized: true })
  })
  mainWindow.on('unmaximize', () => {
    if (!mainWindow.isDestroyed())
      mainWindow.webContents.send('app:window-state-changed', { isMaximized: false })
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.show()
    if (splashWindowToClose && !splashWindowToClose.isDestroyed()) {
      splashWindowToClose.close()
    }
  })

  return mainWindow
}

/** Pencere kontrol IPC kanallarını kaydeder (frameless header için) */
function registerWindowControlHandlers(): void {
  ipcMain.handle('app:window-minimize', () => {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) mainWindowRef.minimize()
  })
  ipcMain.handle('app:window-maximize', () => {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      if (mainWindowRef.isMaximized()) mainWindowRef.unmaximize()
      else mainWindowRef.maximize()
    }
  })
  ipcMain.handle('app:window-close', () => {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) mainWindowRef.close()
  })
  ipcMain.handle('app:window-get-state', () => ({
    isMaximized: mainWindowRef?.isMaximized() ?? false
  }))
}

// Uygulama hazır olduğunda
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.evrak-kayit')
  registerWindowControlHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  logger.info('Uygulama başlatılıyor...', 'Main')
  createSplashWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })

  app.on('before-quit', () => {
    if (serviceManagerRef) {
      serviceManagerRef.dispose()
      serviceManagerRef = null
    }
    Database.getInstance().close()
    logger.info('Uygulama kapatılıyor...', 'Main')
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
