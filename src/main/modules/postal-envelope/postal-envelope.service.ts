// ============================================================
// PostalEnvelopeService - Posta zarfı iş mantığı
//
// Sorumlulukları:
// 1. Bekleyenler havuzu getirme
// 2. Zarf oluşturma validasyonu ve transaction
// 3. Zarf detay ve geçmiş listeleme
// ============================================================

import { BaseService } from '@main/core/BaseService'
import { AppError } from '@main/core/AppError'
import { PostalEnvelopeRepository } from './postal-envelope.repository'
import type {
  PostalEnvelope,
  CreatePostalEnvelopeRequest,
  UpdatePostalEnvelopeRequest,
  PostalEnvelopeDetail,
  PendingPostalDistribution,
  ServiceResponse
} from '@shared/types'
import type { ServiceHandlerMap } from '@main/core/types'

export class PostalEnvelopeService extends BaseService<PostalEnvelope> {
  protected repository: PostalEnvelopeRepository

  constructor() {
    super()
    this.repository = new PostalEnvelopeRepository()
  }

  getModuleName(): string {
    return 'PostalEnvelopeService'
  }

  getChannelPrefix(): string {
    return 'postal-envelope'
  }

  protected override getCustomHandlers(): ServiceHandlerMap {
    return {
      'postal-envelope:get-pending': () => this.handleGetPending(),
      'postal-envelope:create-envelope': (data) =>
        this.handleCreateEnvelope(data as CreatePostalEnvelopeRequest),
      'postal-envelope:get-envelope-detail': (data) =>
        this.handleGetEnvelopeDetail(data as { id: number }),
      'postal-envelope:get-all-envelopes': () => this.handleGetAllEnvelopes(),
      'postal-envelope:update-envelope': (data) =>
        this.handleUpdateEnvelope(data as UpdatePostalEnvelopeRequest)
    }
  }

  /** Bekleyenler havuzunu getirir */
  private async handleGetPending(): Promise<ServiceResponse<PendingPostalDistribution[]>> {
    const pending = this.repository.getPendingDistributions()
    return this.ok(pending, 'Bekleyen dağıtımlar getirildi')
  }

  /** Zarf oluşturma — validasyon + repository transaction */
  private async handleCreateEnvelope(
    data: CreatePostalEnvelopeRequest
  ): Promise<ServiceResponse<PostalEnvelope>> {
    if (!data.recipient_name?.trim()) {
      throw AppError.badRequest('Alıcı adı zorunludur')
    }
    if (!data.distribution_ids?.length) {
      throw AppError.badRequest('En az bir dağıtım seçilmelidir')
    }
    if (!data.stamps?.length) {
      throw AppError.badRequest('En az bir pul eklenmelidir')
    }

    // Pul validasyonu
    for (const stamp of data.stamps) {
      if (!stamp.postal_stamp_id) {
        throw AppError.badRequest('Pul seçimi zorunludur')
      }
      if (!stamp.quantity || stamp.quantity < 1) {
        throw AppError.badRequest('Pul adedi en az 1 olmalıdır')
      }
    }

    const envelope = this.repository.createEnvelopeWithStamps(
      data.recipient_name.trim(),
      data.rr_code?.trim() || '-',
      data.distribution_ids,
      data.stamps
    )

    return this.created(envelope, 'Posta zarfı oluşturuldu')
  }

  /** Tek zarf detayı */
  private async handleGetEnvelopeDetail(data: {
    id: number
  }): Promise<ServiceResponse<PostalEnvelopeDetail | null>> {
    const { id } = this.requireId(data)
    const detail = this.repository.getEnvelopeDetail(id)
    if (!detail) throw AppError.notFound('Zarf bulunamadı')
    return this.ok(detail, 'Zarf detayı getirildi')
  }

  /** Tüm geçmiş zarflar */
  private async handleGetAllEnvelopes(): Promise<ServiceResponse<PostalEnvelopeDetail[]>> {
    const envelopes = this.repository.getAllEnvelopes()
    return this.ok(envelopes, 'Geçmiş zarflar getirildi')
  }

  /** Zarf güncelleme — alıcı adı, rr_code, pullar */
  private async handleUpdateEnvelope(
    data: UpdatePostalEnvelopeRequest
  ): Promise<ServiceResponse<PostalEnvelope>> {
    if (!data.id) throw AppError.badRequest('Zarf ID belirtilmedi')
    if (!data.recipient_name?.trim()) {
      throw AppError.badRequest('Alıcı adı zorunludur')
    }
    if (!data.stamps?.length) {
      throw AppError.badRequest('En az bir pul eklenmelidir')
    }

    for (const stamp of data.stamps) {
      if (!stamp.postal_stamp_id) {
        throw AppError.badRequest('Pul seçimi zorunludur')
      }
      if (!stamp.quantity || stamp.quantity < 1) {
        throw AppError.badRequest('Pul adedi en az 1 olmalıdır')
      }
    }

    const envelope = this.repository.updateEnvelopeWithStamps(
      data.id,
      data.recipient_name.trim(),
      data.rr_code?.trim() || '-',
      data.stamps
    )

    return this.ok(envelope, 'Posta zarfı güncellendi')
  }
}
