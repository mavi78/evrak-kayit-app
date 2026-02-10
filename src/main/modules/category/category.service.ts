// ============================================================
// CategoryService - Kategori iş mantığı
//
// Sorumlulukları:
// 1. CRUD validasyonu
// 2. is_default: sadece bir kayıtta true
// ============================================================

import { BaseService } from '@main/core/BaseService'
import { AppError } from '@main/core/AppError'
import { CategoryRepository } from './category.repository'
import type {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  UpdateSortOrderRequest,
  ServiceResponse
} from '@shared/types'
import type { ServiceHandlerMap } from '@main/core/types'

export class CategoryService extends BaseService<Category> {
  protected repository: CategoryRepository

  constructor() {
    super()
    this.repository = new CategoryRepository()
  }

  getModuleName(): string {
    return 'CategoryService'
  }

  getChannelPrefix(): string {
    return 'category'
  }

  protected override async handleGetAll(): Promise<ServiceResponse<unknown>> {
    const items = this.repository.findAllOrdered()
    return this.ok(items, 'Kayıtlar getirildi')
  }

  protected override async handleCreate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as CreateCategoryRequest
    if (!input.name?.trim()) throw AppError.badRequest('Kategori adı zorunludur')
    const retentionYears = input.retention_years ?? 10
    if (retentionYears < 1 || retentionYears > 100)
      throw AppError.badRequest('Saklanma yılı 1–100 arasında olmalıdır')
    const isDefault = input.is_default ?? false
    if (isDefault) this.repository.clearDefaultExcept(null)
    const item = this.repository.create({
      name: input.name.trim(),
      retention_years: retentionYears,
      sort_order: input.sort_order ?? 0,
      is_default: isDefault,
      is_active: input.is_active ?? true
    })
    return this.created(item, 'Kategori oluşturuldu')
  }

  protected override async handleUpdate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as UpdateCategoryRequest
    const id = input.id
    if (!id) throw AppError.badRequest('Güncellenecek kayıt ID belirtilmedi')
    if (!this.repository.exists(id)) throw AppError.notFound('Kayıt bulunamadı')
    if (
      input.retention_years !== undefined &&
      (input.retention_years < 1 || input.retention_years > 100)
    )
      throw AppError.badRequest('Saklanma yılı 1–100 arasında olmalıdır')
    if (input.is_default === true) this.repository.clearDefaultExcept(id)
    const fields: Record<string, unknown> = {}
    if (input.name !== undefined) fields.name = input.name.trim()
    if (input.retention_years !== undefined) fields.retention_years = input.retention_years
    if (input.sort_order !== undefined) fields.sort_order = input.sort_order
    if (input.is_default !== undefined) fields.is_default = input.is_default
    if (input.is_active !== undefined) fields.is_active = input.is_active
    const item = this.repository.update(id, fields)
    return this.ok(item, 'Kategori güncellendi')
  }

  protected override getCustomHandlers(): ServiceHandlerMap {
    return {
      'category:update-sort-order': (data) => this.handleUpdateSortOrder(data)
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
