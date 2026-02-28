// ============================================================
// Main Process - Uygulama giriş noktası
// Temiz tutulur: Yaşam döngüsü yönetimi ve pencere oluşturma.
// Servisler ServiceManager üzerinden kayıt edilir.
// Splash: Ayrı bir pencerede açılır; backend hazır olunca kapanır,
// ana uygulama penceresi açılır.
// ============================================================

import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Core
import { Logger } from './core/Logger'
import { ServiceManager } from './core/ServiceManager'
import { Database } from './database/Database'

// Modüller
import { AuthService } from './modules/auth/auth.service'
import { UnitService } from './modules/unit/unit.service'
import { ClassificationService } from './modules/classification/classification.service'
import { ChannelService } from './modules/channel/channel.service'
import { FolderService } from './modules/folder/folder.service'
import { CategoryService } from './modules/category/category.service'
import { IncomingDocumentService } from './modules/incoming-document/incoming-document.service'
import { OutgoingDocumentService } from './modules/outgoing-document/outgoing-document.service'
import { TransitDocumentService } from './modules/transit-document/transit-document.service'
import { AppSettingsService } from './modules/app-settings/app-settings.service'
import { PostalStampService } from './modules/postal-stamp/postal-stamp.service'
import { PostalEnvelopeService } from './modules/postal-envelope/postal-envelope.service'

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
  serviceManager.register(new UnitService())
  serviceManager.register(new ClassificationService())
  serviceManager.register(new ChannelService())
  serviceManager.register(new FolderService())
  serviceManager.register(new CategoryService())
  serviceManager.register(new IncomingDocumentService())
  serviceManager.register(new OutgoingDocumentService())
  serviceManager.register(new TransitDocumentService())
  serviceManager.register(new AppSettingsService())
  serviceManager.register(new PostalStampService())
  serviceManager.register(new PostalEnvelopeService())
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

  // ── Senet PDF yazdırma (dinamik sayfa numaralandırma) ──
  // Gizli BrowserWindow ile PDF oluşturma — ana pencereye CSS enjeksiyonu yapılmaz,
  // kullanıcı ara irsaliye görselini görmez.
  ipcMain.handle('app:print-receipt-pdf', async () => {
    if (!mainWindowRef || mainWindowRef.isDestroyed()) {
      return { success: false, data: null, message: 'Pencere bulunamadı', statusCode: 500 }
    }

    let hiddenWindow: BrowserWindow | null = null

    try {
      // Ana penceredeki HTML snapshot'ını al (ReceiptPrintView portali dahil)
      const htmlContent: string = await mainWindowRef.webContents.executeJavaScript(
        'document.documentElement.outerHTML'
      )

      // Gizli pencere oluştur — show:false, kullanıcı hiçbir şey görmez
      hiddenWindow = new BrowserWindow({
        show: false,
        width: 1200,
        height: 800,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      })

      // HTML snapshot'ını gizli pencereye yükle
      await hiddenWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)

      // Print CSS — sadece gizli pencerede uygulanır, ana pencereye dokunulmaz
      const printCss = `
        #root { display: none !important; }
        .mantine-Notifications-root { display: none !important; }
        .mantine-LoadingOverlay-root { display: none !important; }
        .receipt-print-container {
          position: static !important;
          left: auto !important;
          top: auto !important;
          width: 100% !important;
          height: auto !important;
          overflow: visible !important;
          display: block !important;
          pointer-events: auto !important;
        }
        .print-area {
          display: block !important;
          width: 100% !important;
          padding: 5mm 8mm !important;
          box-sizing: border-box !important;
          font-family: 'Times New Roman', Times, serif !important;
        }
        html, body {
          width: 100% !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        table {
          width: 100% !important;
          border: 2px solid #000 !important;
          background-color: #ffffff !important;
          font-family: 'Times New Roman', Times, serif !important;
        }
        thead { display: table-row-group !important; }
        th, td {
          border: 1px solid #000 !important;
          color: #000 !important;
          background-color: #ffffff !important;
          font-family: 'Times New Roman', Times, serif !important;
        }
        tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      `

      // CSS'i gizli pencereye enjekte et
      await hiddenWindow.webContents.insertCSS(printCss)

      const footerTemplate = `
        <div style="width: 100%; font-size: 9px; font-family: Arial, sans-serif; padding: 0 15mm; box-sizing: border-box; text-align: right;">
          <span>Sayfa <span class="pageNumber"></span>/<span class="totalPages"></span></span>
        </div>
      `

      // PDF'i gizli pencereden oluştur
      const pdfBuffer = await hiddenWindow.webContents.printToPDF({
        landscape: true,
        pageSize: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate,
        margins: {
          top: 0.2,
          bottom: 0.4,
          left: 0.2,
          right: 0.2
        }
      })

      // Gizli pencereyi kapat — artık gerekli değil
      hiddenWindow.close()
      hiddenWindow = null

      // PDF'i temp dosyaya kaydet
      const fileName = `senet_${Date.now()}.pdf`
      const filePath = join(tmpdir(), fileName)
      await writeFile(filePath, pdfBuffer)

      // Yeni bir BrowserWindow içinde PDF önizleme aç
      const previewWindow = new BrowserWindow({
        width: 1100,
        height: 780,
        title: 'Senet Yazdırma Önizleme',
        parent: mainWindowRef,
        modal: true,
        autoHideMenuBar: true,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      })

      // PDF dosyasını pencerede aç
      await previewWindow.loadURL(`file://${filePath}`)

      // Preview penceresi kapanana kadar bekle (yazdırma tamamlanması veya kullanıcı kapatması)
      // Bu sayede renderer'daki loading overlay doğru zamanda kapanır.
      await new Promise<void>((resolve) => {
        // Pencere kapatıldığında temp dosyayı sil ve resolve et
        previewWindow.on('closed', () => {
          unlink(filePath).catch(() => {
            /* sessiz hata */
          })
          resolve()
        })

        // PDF viewer'ın tam yüklenmesini bekle, sonra yazdırma diyaloğunu aç
        previewWindow.webContents.once('did-finish-load', () => {
          // PDF viewer plugin'inin hazır olması için gecikme gerekiyor
          setTimeout(() => {
            if (previewWindow.isDestroyed()) return
            previewWindow.webContents.print(
              { silent: false, printBackground: true },
              (success, failureReason) => {
                if (!success && failureReason !== 'cancelled') {
                  logger.warn(`Yazdırma başarısız: ${failureReason}`, 'PrintPDF')
                }
                // Yazdırma tamamlandı veya iptal edildi → pencereyi kapat
                if (!previewWindow.isDestroyed()) {
                  previewWindow.close()
                }
              }
            )
          }, 2000)
        })
      })

      return { success: true, data: null, message: 'Yazdırma başlatıldı', statusCode: 200 }
    } catch (error) {
      // Hata durumunda gizli pencereyi temizle
      if (hiddenWindow && !hiddenWindow.isDestroyed()) {
        hiddenWindow.close()
      }
      logger.error('PDF oluşturma hatası', error instanceof Error ? error : undefined, 'PrintPDF')
      return {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : 'PDF oluşturulamadı',
        statusCode: 500
      }
    }
  })
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
