// ============================================================
// ClassificationService - Gizlilik derecesi iş mantığı
//
// Sorumlulukları:
// 1. CRUD validasyonu
// 2. is_default: sadece bir kayıtta true — create/update'te diğerlerini sıfırlama
// ============================================================

import { BaseService } from '@main/core/BaseService'
import { AppError } from '@main/core/AppError'
import { ClassificationRepository } from './classification.repository'
import type {
  Classification,
  CreateClassificationRequest,
  UpdateClassificationRequest,
  UpdateSortOrderRequest,
  ServiceResponse
} from '@shared/types'
import type { ServiceHandlerMap } from '@main/core/types'

export class ClassificationService extends BaseService<Classification> {
  protected repository: ClassificationRepository

  constructor() {
    super()
    this.repository = new ClassificationRepository()
  }

  getModuleName(): string {
    return 'ClassificationService'
  }

  getChannelPrefix(): string {
    return 'classification'
  }

  protected override async handleGetAll(): Promise<ServiceResponse<unknown>> {
    const items = this.repository.findAllOrdered()
    return this.ok(items, 'Kayıtlar getirildi')
  }

  protected override async handleCreate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as CreateClassificationRequest
    if (!input.name?.trim()) throw AppError.badRequest('Gizlilik adı zorunludur')
    if (!input.short_name?.trim()) throw AppError.badRequest('Gizlilik kısa adı zorunludur')
    const sortOrder = input.sort_order ?? 0
    const isDefault = input.is_default ?? false
    if (isDefault) this.repository.clearDefaultExcept(null)
    const item = this.repository.create({
      name: input.name.trim(),
      short_name: input.short_name.trim(),
      requires_security_number: input.requires_security_number ?? false,
      sort_order: sortOrder,
      is_default: isDefault,
      is_active: input.is_active ?? true
    })
    return this.created(item, 'Gizlilik derecesi oluşturuldu')
  }

  protected override async handleUpdate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as UpdateClassificationRequest
    const id = input.id
    if (!id) throw AppError.badRequest('Güncellenecek kayıt ID belirtilmedi')
    if (!this.repository.exists(id)) throw AppError.notFound('Kayıt bulunamadı')
    if (input.is_default === true) this.repository.clearDefaultExcept(id)
    const fields: Record<string, unknown> = {}
    if (input.name !== undefined) fields.name = input.name.trim()
    if (input.short_name !== undefined) fields.short_name = input.short_name.trim()
    if (input.requires_security_number !== undefined)
      fields.requires_security_number = input.requires_security_number
    if (input.sort_order !== undefined) fields.sort_order = input.sort_order
    if (input.is_default !== undefined) fields.is_default = input.is_default
    if (input.is_active !== undefined) fields.is_active = input.is_active
    const item = this.repository.update(id, fields)
    return this.ok(item, 'Gizlilik derecesi güncellendi')
  }

  protected override getCustomHandlers(): ServiceHandlerMap {
    return {
      'classification:update-sort-order': (data) => this.handleUpdateSortOrder(data)
    }
  }

  private async handleUpdateSortOrder(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as UpdateSortOrderRequest
    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      throw AppError.badRequest('Güncellenecek kayıtlar belirtilmedi')
    }
    this.repository.batchUpdateSortOrder(input.items)
    return this.ok(true, 'Sıralama güncellendi')
  }
}
