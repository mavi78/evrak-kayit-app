// ============================================================
// PostalStampService - Posta pulu iş mantığı
//
// Sorumlulukları:
// 1. CRUD validasyonu
// 2. Tutar doğrulaması
// ============================================================

import { BaseService } from '@main/core/BaseService'
import { AppError } from '@main/core/AppError'
import { PostalStampRepository } from './postal-stamp.repository'
import type {
  PostalStamp,
  CreatePostalStampRequest,
  UpdatePostalStampRequest,
  ServiceResponse
} from '@shared/types'

export class PostalStampService extends BaseService<PostalStamp> {
  protected repository: PostalStampRepository

  constructor() {
    super()
    this.repository = new PostalStampRepository()
  }

  getModuleName(): string {
    return 'PostalStampService'
  }

  getChannelPrefix(): string {
    return 'postal-stamp'
  }

  protected override async handleCreate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as CreatePostalStampRequest
    if (input.amount === undefined || input.amount === null)
      throw AppError.badRequest('Tutar zorunludur')
    if (input.amount < 0) throw AppError.badRequest('Tutar negatif olamaz')

    const item = this.repository.create({
      amount: input.amount,
      is_active: input.is_active ?? true
    })
    return this.created(item, 'Posta pulu oluşturuldu')
  }

  protected override async handleUpdate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as UpdatePostalStampRequest
    const id = input.id
    if (!id) throw AppError.badRequest('Güncellenecek kayıt ID belirtilmedi')
    if (!this.repository.exists(id)) throw AppError.notFound('Kayıt bulunamadı')
    if (input.amount !== undefined && input.amount < 0)
      throw AppError.badRequest('Tutar negatif olamaz')

    const fields: Record<string, unknown> = {}
    if (input.amount !== undefined) fields.amount = input.amount
    if (input.is_active !== undefined) fields.is_active = input.is_active

    const item = this.repository.update(id, fields)
    return this.ok(item, 'Posta pulu güncellendi')
  }
}
