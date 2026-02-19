// ============================================================
// AppSettingsService - Uygulama ayarları IPC servisi
//
// Sorumlulukları:
// 1. app-settings:get — ayar değeri getir
// 2. app-settings:set — ayar değeri kaydet
// 3. app-settings:get-organization — birlik ID kısayolu
//
// BaseService extend edilmez (key-value, CRUD pattern uygulanmaz)
// ============================================================

import { Logger } from '@main/core/Logger'
import { AppError } from '@main/core/AppError'
import { STATUS_CODES } from '@shared/utils/constants'
import { AppSettingsRepository } from './app-settings.repository'
import { APP_SETTING_KEYS } from '@shared/types'
import type {
  ServiceResponse,
  AppSetting,
  GetSettingRequest,
  SetSettingRequest
} from '@shared/types'
import type { IpcRegistrable, IpcHandlerMap, ServiceHandlerMap } from '@main/core/types'

export class AppSettingsService implements IpcRegistrable {
  private repository: AppSettingsRepository
  private logger: Logger

  constructor() {
    this.repository = new AppSettingsRepository()
    this.logger = Logger.getInstance()
  }

  getModuleName(): string {
    return 'AppSettingsService'
  }

  // ================================================================
  // IPC HANDLER'LAR
  // ================================================================

  getHandlers(): IpcHandlerMap {
    const handlers: ServiceHandlerMap = {
      'app-settings:get': (data) => this.handleGet(data),
      'app-settings:set': (data) => this.handleSet(data),
      'app-settings:get-organization': () => this.handleGetOrganization()
    }

    // Hata yönetimi ile sarla
    const wrapped: IpcHandlerMap = {}
    for (const [channel, handler] of Object.entries(handlers)) {
      wrapped[channel] = async (
        _event: Electron.IpcMainInvokeEvent,
        data: unknown
      ): Promise<ServiceResponse<unknown>> => {
        try {
          return await handler(data)
        } catch (err: unknown) {
          return this.handleError(err)
        }
      }
    }

    return wrapped
  }

  // ================================================================
  // HANDLER İMPLEMENTASYONLARI
  // ================================================================

  private async handleGet(data: unknown): Promise<ServiceResponse<AppSetting | null>> {
    const { key } = data as GetSettingRequest
    if (!key) throw AppError.badRequest('Ayar anahtarı belirtilmedi')

    const setting = this.repository.getSetting(key)
    return this.ok(setting, 'Ayar getirildi')
  }

  private async handleSet(data: unknown): Promise<ServiceResponse<AppSetting>> {
    const { key, value } = data as SetSettingRequest
    if (!key) throw AppError.badRequest('Ayar anahtarı belirtilmedi')
    if (value === undefined || value === null) throw AppError.badRequest('Ayar değeri belirtilmedi')

    const setting = this.repository.setSetting(key, String(value))
    return this.ok(setting, 'Ayar kaydedildi')
  }

  private async handleGetOrganization(): Promise<ServiceResponse<AppSetting | null>> {
    const setting = this.repository.getSetting(APP_SETTING_KEYS.ORGANIZATION_UNIT_ID)
    return this.ok(setting, 'Birlik ayarı getirildi')
  }

  // ================================================================
  // YARDIMCILAR
  // ================================================================

  private ok<R>(data: R, message: string): ServiceResponse<R> {
    return { success: true, data, message, statusCode: STATUS_CODES.OK }
  }

  private handleError(err: unknown): ServiceResponse<null> {
    if (err instanceof AppError) {
      this.logger.error(err.message, err, this.getModuleName())
      return {
        success: false,
        data: null,
        message: err.message,
        statusCode: err.statusCode
      }
    }

    const message = err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu'
    this.logger.error(message, err instanceof Error ? err : undefined, this.getModuleName())
    return {
      success: false,
      data: null,
      message,
      statusCode: STATUS_CODES.INTERNAL_ERROR
    }
  }
}
