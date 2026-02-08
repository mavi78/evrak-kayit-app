// ============================================================
// BaseService - Tüm servis sınıflarının temel sınıfı
//
// Sorumlulukları:
// 1. Standart CRUD IPC handler'ları (get-all, get-by-id, create, update, delete)
//    -> Alt sınıflarda tekrar yazılmaz, gerekirse override edilir
// 2. Otomatik hata sarmalama (wrap) - tüm handler'lar try/catch ile korunur
// 3. Tutarlı yanıt formatı (ok, created, fail)
// 4. Merkezi hata yönetimi (handleError)
//
// Yeni modül eklemek:
//   - getModuleName(), getChannelPrefix() tanımla
//   - repository ata
//   - Gerekirse handleCreate/handleUpdate override et (validation)
//   - getCustomHandlers() ile özel IPC kanalları ekle
// ============================================================

import { Logger } from './Logger'
import { AppError } from './AppError'
import { STATUS_CODES } from '@shared/utils/constants'
import type { BaseRepository } from './BaseRepository'
import type { ServiceResponse, BaseEntity } from '@shared/types'
import type { IpcRegistrable, IpcHandlerMap, ServiceHandlerMap } from './types'

export abstract class BaseService<T extends BaseEntity> implements IpcRegistrable {
  protected abstract repository: BaseRepository<T>
  protected logger: Logger

  constructor() {
    this.logger = Logger.getInstance()
  }

  /** Modül adı - log ve hata mesajlarında kullanılır */
  abstract getModuleName(): string

  /** IPC kanal öneki - CRUD handler'ları bu önekle oluşturulur */
  abstract getChannelPrefix(): string

  // ================================================================
  // STANDART CRUD HANDLER'LARI
  // Alt sınıflar gerektiğinde override edebilir (validation, transform vb.)
  // ================================================================

  /**
   * Tüm kayıtları getir.
   * Return tipi unknown: override eden servisler farklı tip dönebilir
   * (örn: AuthService şifreyi çıkarıp UserWithoutPassword döner)
   */
  protected async handleGetAll(): Promise<ServiceResponse<unknown>> {
    const items = this.repository.findAll()
    return this.ok(items, 'Kayıtlar başarıyla getirildi')
  }

  /** ID ile tek kayıt getir */
  protected async handleGetById(data: unknown): Promise<ServiceResponse<unknown>> {
    const { id } = this.requireId(data)
    const item = this.repository.findById(id)
    if (!item) throw AppError.notFound('Kayıt bulunamadı')
    return this.ok(item, 'Kayıt başarıyla getirildi')
  }

  /** Yeni kayıt oluştur */
  protected async handleCreate(data: unknown): Promise<ServiceResponse<unknown>> {
    const item = this.repository.create(data as Record<string, unknown>)
    return this.created(item, 'Kayıt başarıyla oluşturuldu')
  }

  /** Kayıt güncelle */
  protected async handleUpdate(data: unknown): Promise<ServiceResponse<unknown>> {
    const updateData = data as Record<string, unknown>
    const id = updateData.id as number
    if (!id) throw AppError.badRequest('Güncellenecek kayıt ID belirtilmedi')
    if (!this.repository.exists(id)) throw AppError.notFound('Güncellenecek kayıt bulunamadı')

    const fields = { ...updateData } as Record<string, unknown>
    delete fields.id
    const item = this.repository.update(id, fields)
    return this.ok(item, 'Kayıt başarıyla güncellendi')
  }

  /** Kayıt sil */
  protected async handleDelete(data: unknown): Promise<ServiceResponse<unknown>> {
    const { id } = this.requireId(data)
    if (!this.repository.exists(id)) throw AppError.notFound('Silinecek kayıt bulunamadı')
    const result = this.repository.delete(id)
    return this.ok(result, 'Kayıt başarıyla silindi')
  }

  // ================================================================
  // IPC HANDLER YÖNETİMİ
  // ================================================================

  /**
   * Alt sınıflar ek IPC kanalları eklemek için override eder.
   * Döndürülen handler'lar otomatik olarak hata yönetimi ile sarmalanır.
   */
  protected getCustomHandlers(): ServiceHandlerMap {
    return {}
  }

  /**
   * Standart CRUD + özel handler'ları birleştirir.
   * TÜM handler'lar otomatik try/catch ile sarmalanır - hata ezilmez.
   */
  getHandlers(): IpcHandlerMap {
    const prefix = this.getChannelPrefix()

    // Standart CRUD
    const standardHandlers: ServiceHandlerMap = {
      [`${prefix}:get-all`]: () => this.handleGetAll(),
      [`${prefix}:get-by-id`]: (data) => this.handleGetById(data),
      [`${prefix}:create`]: (data) => this.handleCreate(data),
      [`${prefix}:update`]: (data) => this.handleUpdate(data),
      [`${prefix}:delete`]: (data) => this.handleDelete(data)
    }

    // Standart + özel handler'ları birleştir
    const allHandlers: ServiceHandlerMap = {
      ...standardHandlers,
      ...this.getCustomHandlers()
    }

    // Hepsini otomatik hata yönetimi ile sarla
    const wrapped: IpcHandlerMap = {}
    for (const [channel, handler] of Object.entries(allHandlers)) {
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
  // YANIT YARDIMCILARI
  // ================================================================

  /** 200 OK yanıtı */
  protected ok<R>(data: R, message: string = 'İşlem başarılı'): ServiceResponse<R> {
    return { success: true, data, message, statusCode: STATUS_CODES.OK }
  }

  /** 201 Created yanıtı */
  protected created<R>(data: R, message: string = 'Kayıt oluşturuldu'): ServiceResponse<R> {
    return { success: true, data, message, statusCode: STATUS_CODES.CREATED }
  }

  /** Hata yanıtı */
  protected fail(
    message: string,
    statusCode: number = STATUS_CODES.INTERNAL_ERROR
  ): ServiceResponse<null> {
    return { success: false, data: null, message, statusCode }
  }

  // ================================================================
  // MERKEZİ HATA YÖNETİMİ
  // ================================================================

  /** Tüm hataları yakalar, loglar ve tutarlı ServiceResponse döner */
  protected handleError(err: unknown): ServiceResponse<null> {
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

  // ================================================================
  // YARDIMCILAR
  // ================================================================

  /** data'dan id alanını doğrular ve döner */
  protected requireId(data: unknown): { id: number } {
    const parsed = data as Record<string, unknown>
    const id = parsed?.id
    if (typeof id !== 'number' || id <= 0) {
      throw AppError.badRequest('Geçerli bir ID belirtilmedi')
    }
    return { id }
  }
}
