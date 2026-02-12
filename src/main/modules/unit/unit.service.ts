// ============================================================
// UnitService - Birlik iş mantığı ve IPC handler'ları
//
// Sorumlulukları:
// 1. Birlik CRUD validasyonu
// 2. get-all sıralı liste döner (findAllOrdered)
// ============================================================

import { BaseService } from '@main/core/BaseService'
import { AppError } from '@main/core/AppError'
import { UnitRepository } from './unit.repository'
import type {
  Unit,
  CreateUnitRequest,
  UpdateUnitRequest,
  UpdateUnitHierarchyRequest,
  UpdateUnitSortOrderRequest,
  ServiceResponse
} from '@shared/types'
import type { ServiceHandlerMap } from '@main/core/types'

export class UnitService extends BaseService<Unit> {
  protected repository: UnitRepository

  constructor() {
    super()
    this.repository = new UnitRepository()
  }

  getModuleName(): string {
    return 'UnitService'
  }

  getChannelPrefix(): string {
    return 'unit'
  }

  protected override async handleGetAll(): Promise<ServiceResponse<unknown>> {
    const items = this.repository.findAllOrdered()
    return this.ok(items, 'Kayıtlar getirildi')
  }

  protected override async handleCreate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as CreateUnitRequest
    if (!input.name?.trim()) throw AppError.badRequest('Birlik adı zorunludur')
    if (!input.short_name?.trim()) throw AppError.badRequest('Birlik kısa ad zorunludur')
    if (input.parent_id != null) {
      const parent = this.repository.findById(input.parent_id)
      if (!parent) throw AppError.badRequest('Üst birlik bulunamadı')
    }
    const parentId = input.parent_id ?? null
    if (this.repository.findByNameAndParent(input.name.trim(), parentId)) {
      throw AppError.badRequest('Bu seviyede aynı birlik adı zaten kayıtlı')
    }
    if (this.repository.findByShortNameAndParent(input.short_name.trim(), parentId)) {
      throw AppError.badRequest('Bu seviyede aynı kısa ad zaten kayıtlı')
    }
    const item = this.repository.create({
      name: input.name.trim(),
      short_name: input.short_name.trim(),
      parent_id: input.parent_id ?? null,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true
    })
    return this.created(item, 'Birlik oluşturuldu')
  }

  protected override async handleUpdate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as UpdateUnitRequest
    const id = input.id
    if (!id) throw AppError.badRequest('Güncellenecek kayıt ID belirtilmedi')
    if (!this.repository.exists(id)) throw AppError.notFound('Kayıt bulunamadı')
    if (input.parent_id != null) {
      const parent = this.repository.findById(input.parent_id)
      if (!parent) throw AppError.badRequest('Üst birlik bulunamadı')
      if (input.parent_id === id) throw AppError.badRequest('Birlik kendisinin üst birimi olamaz')
    }
    const current = this.repository.findById(id)!
    const effectiveParentId = input.parent_id !== undefined ? input.parent_id : current.parent_id
    // Üst birlik değişiyorsa (taşıma): hedef seviyede aynı ad/kısa ad var mı kontrol et
    if (
      input.parent_id !== undefined &&
      (input.parent_id ?? null) !== (current.parent_id ?? null)
    ) {
      const nameToCheck = input.name !== undefined ? input.name.trim() : current.name
      const shortNameToCheck =
        input.short_name !== undefined ? input.short_name.trim() : current.short_name
      if (
        this.repository.findByNameAndParent(nameToCheck, input.parent_id ?? null, id)
      ) {
        throw AppError.badRequest(
          'Taşıma yapılamaz: Hedef seviyede aynı birlik adı zaten mevcut'
        )
      }
      if (
        this.repository.findByShortNameAndParent(shortNameToCheck, input.parent_id ?? null, id)
      ) {
        throw AppError.badRequest(
          'Taşıma yapılamaz: Hedef seviyede aynı kısa ad zaten mevcut'
        )
      }
    }
    if (input.name !== undefined) {
      if (this.repository.findByNameAndParent(input.name.trim(), effectiveParentId, id)) {
        throw AppError.badRequest('Bu seviyede aynı birlik adı zaten kayıtlı')
      }
    }
    if (input.short_name !== undefined) {
      if (this.repository.findByShortNameAndParent(input.short_name.trim(), effectiveParentId, id)) {
        throw AppError.badRequest('Bu seviyede aynı kısa ad zaten kayıtlı')
      }
    }
    const fields: Record<string, unknown> = {}
    if (input.name !== undefined) fields.name = input.name.trim()
    if (input.short_name !== undefined) fields.short_name = input.short_name.trim()
    if (input.parent_id !== undefined) fields.parent_id = input.parent_id
    if (input.sort_order !== undefined) fields.sort_order = input.sort_order
    if (input.is_active !== undefined) fields.is_active = input.is_active
    const item = this.repository.update(id, fields)
    return this.ok(item, 'Birlik güncellendi')
  }

  protected override getCustomHandlers(): ServiceHandlerMap {
    return {
      'unit:update-hierarchy': (data) => this.handleUpdateHierarchy(data),
      'unit:update-sort-order': (data) => this.handleUpdateSortOrder(data)
    }
  }

  private async handleUpdateHierarchy(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as UpdateUnitHierarchyRequest
    if (!input.id) throw AppError.badRequest('Birlik ID belirtilmedi')
    const unit = this.repository.findById(input.id)
    if (!unit) throw AppError.notFound('Birlik bulunamadı')
    if (input.parent_id != null && !this.repository.exists(input.parent_id)) {
      throw AppError.badRequest('Üst birlik bulunamadı')
    }
    // Taşıma hedefinde aynı ad veya kısa ad varsa taşımaya izin verme
    const targetParentId = input.parent_id ?? null
    if (this.repository.findByNameAndParent(unit.name, targetParentId, unit.id)) {
      throw AppError.badRequest(
        'Taşıma yapılamaz: Hedef seviyede aynı birlik adı zaten mevcut'
      )
    }
    if (this.repository.findByShortNameAndParent(unit.short_name, targetParentId, unit.id)) {
      throw AppError.badRequest(
        'Taşıma yapılamaz: Hedef seviyede aynı kısa ad zaten mevcut'
      )
    }
    const item = this.repository.updateHierarchy(input.id, input.parent_id, input.sort_order)
    return this.ok(item, 'Birlik hiyerarşisi güncellendi')
  }

  private async handleUpdateSortOrder(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as UpdateUnitSortOrderRequest
    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      throw AppError.badRequest('Güncellenecek kayıtlar belirtilmedi')
    }
    this.repository.batchUpdateSortOrder(input.items)
    return this.ok(true, 'Sıralama güncellendi')
  }
}
