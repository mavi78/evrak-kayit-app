// ============================================================
// ChannelService - Kanal iş mantığı
//
// Sorumlulukları:
// 1. CRUD validasyonu
// 2. is_default: sadece bir kayıtta true
// ============================================================

import { BaseService } from '@main/core/BaseService'
import { AppError } from '@main/core/AppError'
import { ChannelRepository } from './channel.repository'
import type {
  Channel,
  CreateChannelRequest,
  UpdateChannelRequest,
  UpdateSortOrderRequest,
  ServiceResponse
} from '@shared/types'
import type { ServiceHandlerMap } from '@main/core/types'

export class ChannelService extends BaseService<Channel> {
  protected repository: ChannelRepository

  constructor() {
    super()
    this.repository = new ChannelRepository()
  }

  getModuleName(): string {
    return 'ChannelService'
  }

  getChannelPrefix(): string {
    return 'channel'
  }

  protected override async handleGetAll(): Promise<ServiceResponse<unknown>> {
    const items = this.repository.findAllOrdered()
    return this.ok(items, 'Kayıtlar getirildi')
  }

  protected override async handleCreate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as CreateChannelRequest
    if (!input.name?.trim()) throw AppError.badRequest('Kanal adı zorunludur')
    const isDefault = input.is_default ?? false
    if (isDefault) this.repository.clearDefaultExcept(null)
    const item = this.repository.create({
      name: input.name.trim(),
      sort_order: input.sort_order ?? 0,
      is_default: isDefault,
      is_active: input.is_active ?? true
    })
    return this.created(item, 'Kanal oluşturuldu')
  }

  protected override async handleUpdate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as UpdateChannelRequest
    const id = input.id
    if (!id) throw AppError.badRequest('Güncellenecek kayıt ID belirtilmedi')
    if (!this.repository.exists(id)) throw AppError.notFound('Kayıt bulunamadı')
    if (input.is_default === true) this.repository.clearDefaultExcept(id)
    const fields: Record<string, unknown> = {}
    if (input.name !== undefined) fields.name = input.name.trim()
    if (input.sort_order !== undefined) fields.sort_order = input.sort_order
    if (input.is_default !== undefined) fields.is_default = input.is_default
    if (input.is_active !== undefined) fields.is_active = input.is_active
    const item = this.repository.update(id, fields)
    return this.ok(item, 'Kanal güncellendi')
  }

  protected override getCustomHandlers(): ServiceHandlerMap {
    return {
      'channel:update-sort-order': (data) => this.handleUpdateSortOrder(data)
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
