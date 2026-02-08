// ============================================================
// ServiceManager - Tüm servislerin IPC kanallarını kayıt eder
// Neden: Main index dosyasını temiz tutar. Yeni modül eklemek
// sadece bu dosyaya register çağrısı eklemek demektir.
// ============================================================

import { ipcMain } from 'electron'
import { Logger } from './Logger'
import type { IpcRegistrable } from './types'

export class ServiceManager {
  private registrables: IpcRegistrable[] = []
  private logger: Logger

  constructor() {
    this.logger = Logger.getInstance()
  }

  /** Servis/modül kayıt eder */
  register(registrable: IpcRegistrable): void {
    this.registrables.push(registrable)
    this.logger.info(`Modül kayıt edildi: ${registrable.getModuleName()}`, 'ServiceManager')
  }

  /**
   * Tüm kayıtlı servislerin IPC handler'larını aktifleştirir.
   * @param progressCallback - Her modül yüklendiğinde çağrılır (splash ekranı ilerlemesi için)
   */
  initialize(progressCallback?: (moduleName: string) => void): void {
    this.logger.info('Servisler başlatılıyor...', 'ServiceManager')

    let totalChannels = 0

    for (const registrable of this.registrables) {
      const handlers = registrable.getHandlers()
      const moduleName = registrable.getModuleName()

      for (const [channel, handler] of Object.entries(handlers)) {
        ipcMain.handle(channel, handler)
        totalChannels++
        this.logger.debug(`IPC kanal kayıt edildi: ${channel}`, moduleName)
      }

      progressCallback?.(moduleName)
    }

    this.logger.info(
      `Toplam ${this.registrables.length} modül, ${totalChannels} IPC kanalı kayıt edildi`,
      'ServiceManager'
    )
  }

  /** Tüm IPC handler'larını kaldırır (test veya yeniden başlatma için) */
  dispose(): void {
    for (const registrable of this.registrables) {
      const handlers = registrable.getHandlers()
      for (const channel of Object.keys(handlers)) {
        ipcMain.removeHandler(channel)
      }
    }
    this.registrables = []
    this.logger.info('Tüm servisler kaldırıldı', 'ServiceManager')
  }
}
