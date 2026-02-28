// ============================================================
// IncomingDocumentService - Gelen evrak iş mantığı
//
// Sorumlulukları:
// 1. Gün sıra no otomatik atama (K.No olarak id kullanılır)
// 2. Tarihi'den document_type (EVRAK/MESAJ) hesaplama
// 3. EVRAK + requires_security_number ise Güv.Kont. Nu zorunlu; MESAJ ise zorunlu değil
// 4. Dağıtım CRUD (generic: INCOMING/OUTGOING/TRANSIT)
// 5. Teslim işlemi — atomik senet no üretimi
// ============================================================

import { BaseService } from '@main/core/BaseService'
import { AppError } from '@main/core/AppError'
import { IncomingDocumentRepository } from './incoming-document.repository'
import { DistributionRepository } from './incoming-document-distribution.repository'
import { ReceiptCounterRepository } from './receipt-counter.repository'
import { ChannelRepository } from '@main/modules/channel/channel.repository'
import { ClassificationRepository } from '@main/modules/classification/classification.repository'
import { UnitRepository } from '@main/modules/unit/unit.repository'
import { PostalEnvelopeRepository } from '@main/modules/postal-envelope/postal-envelope.repository'
import { parseDocumentDateInput, isSecurityControlNoRequired } from '@shared/utils'
import type {
  IncomingDocument,
  DocumentDistribution,
  CreateIncomingDocumentRequest,
  UpdateIncomingDocumentRequest,
  SearchIncomingDocumentsRequest,
  PaginatedIncomingDocumentsResponse,
  NextRecordInfoResponse,
  CreateDistributionRequest,
  UpdateDistributionRequest,
  DeliverDistributionRequest,
  CourierPendingDistribution,
  BulkDeliverRequest,
  BulkDeliverResponse,
  DeliveredReceiptInfo,
  CourierDeliveredListRequest,
  ServiceResponse,
  DocumentScope
} from '@shared/types'
import type { ServiceHandlerMap } from '@main/core/types'

export class IncomingDocumentService extends BaseService<IncomingDocument> {
  protected repository: IncomingDocumentRepository
  protected distributionRepository: DistributionRepository
  protected receiptCounterRepository: ReceiptCounterRepository
  protected classificationRepository: ClassificationRepository
  protected channelRepository: ChannelRepository
  protected unitRepository: UnitRepository
  protected postalEnvelopeRepository: PostalEnvelopeRepository

  constructor() {
    super()
    this.repository = new IncomingDocumentRepository()
    this.distributionRepository = new DistributionRepository()
    this.receiptCounterRepository = new ReceiptCounterRepository()
    this.classificationRepository = new ClassificationRepository()
    this.channelRepository = new ChannelRepository()
    this.unitRepository = new UnitRepository()
    this.postalEnvelopeRepository = new PostalEnvelopeRepository()
  }

  getModuleName(): string {
    return 'IncomingDocumentService'
  }

  getChannelPrefix(): string {
    return 'incoming-document'
  }

  protected getDocumentScope(): DocumentScope {
    return 'INCOMING'
  }

  protected override async handleCreate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as CreateIncomingDocumentRequest
    const { document_date_input, channel_id, classification_id, category_id, folder_id } = input
    if (!document_date_input?.trim()) throw AppError.badRequest('Tarihi alanı zorunludur')
    if (!channel_id) throw AppError.badRequest('Gel. Kanal zorunludur')
    if (!classification_id) throw AppError.badRequest('Gizlilik derecesi zorunludur')
    if (!category_id) throw AppError.badRequest('Kategorisi zorunludur')
    if (!folder_id) throw AppError.badRequest('Klasör zorunludur')

    const parsed = parseDocumentDateInput(document_date_input.trim())
    const documentType = parsed.type
    const documentDate = parsed.dateValue

    const classification = this.classificationRepository.findById(classification_id)
    if (!classification) throw AppError.badRequest('Seçilen gizlilik derecesi bulunamadı')
    const requiresSecurityNo = classification.requires_security_number
    if (isSecurityControlNoRequired(documentType, requiresSecurityNo)) {
      if (!input.security_control_no?.trim()) {
        throw AppError.badRequest(
          'Güvenlik kontrol numarası zorunludur (EVRAK + gizlilik derecesi)'
        )
      }
    }

    const now = new Date()
    const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    // Atomik oluşturma: day_sequence_no ve INSERT tek transaction'da
    const item = this.repository.createWithAutoNumbers(todayDate, {
      channel_id,
      source_office: (input.source_office ?? '').trim(),
      reference_number: (input.reference_number ?? '').trim(),
      subject: (input.subject ?? '').trim(),
      document_date: documentDate,
      document_type: documentType,
      attachment_count: input.attachment_count ?? 0,
      classification_id,
      security_control_no: documentType === 'MESAJ' ? '' : (input.security_control_no ?? '').trim(),
      page_count: input.page_count ?? 0,
      category_id,
      folder_id
    })
    return this.created(item, 'Gelen evrak kaydı oluşturuldu')
  }

  protected override async handleUpdate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as UpdateIncomingDocumentRequest
    const { id } = input
    if (!id) throw AppError.badRequest('Güncellenecek kayıt ID belirtilmedi')
    const existing = this.repository.findById(id)
    if (!existing) throw AppError.notFound('Kayıt bulunamadı')

    let documentType = existing.document_type
    let documentDate = existing.document_date
    if (input.document_date_input != null && input.document_date_input.trim() !== '') {
      const parsed = parseDocumentDateInput(input.document_date_input.trim())
      documentType = parsed.type
      documentDate = parsed.dateValue
    }

    const classificationId = input.classification_id ?? existing.classification_id
    const classification = this.classificationRepository.findById(classificationId)
    if (!classification) throw AppError.badRequest('Seçilen gizlilik derecesi bulunamadı')
    const requiresSecurityNo = classification.requires_security_number
    if (isSecurityControlNoRequired(documentType, requiresSecurityNo)) {
      const securityNo =
        input.security_control_no !== undefined
          ? input.security_control_no
          : existing.security_control_no
      if (!securityNo?.trim()) {
        throw AppError.badRequest(
          'Güvenlik kontrol numarası zorunludur (EVRAK + gizlilik derecesi)'
        )
      }
    }

    const fields: Record<string, unknown> = {}
    if (input.channel_id !== undefined) fields.channel_id = input.channel_id
    if (input.source_office !== undefined) fields.source_office = input.source_office.trim()
    if (input.reference_number !== undefined)
      fields.reference_number = input.reference_number.trim()
    if (input.subject !== undefined) fields.subject = input.subject.trim()
    fields.document_date = documentDate
    fields.document_type = documentType
    if (input.attachment_count !== undefined) fields.attachment_count = input.attachment_count
    if (input.classification_id !== undefined) fields.classification_id = input.classification_id
    if (documentType === 'MESAJ') {
      fields.security_control_no = ''
    } else if (input.security_control_no !== undefined) {
      fields.security_control_no =
        input.security_control_no === null ? '' : input.security_control_no.trim()
    }
    if (input.page_count !== undefined) fields.page_count = input.page_count
    if (input.category_id !== undefined) fields.category_id = input.category_id
    if (input.folder_id !== undefined) fields.folder_id = input.folder_id

    const item = this.repository.update(id, fields)
    return this.ok(item, 'Gelen evrak kaydı güncellendi')
  }

  protected override getCustomHandlers(): ServiceHandlerMap {
    return {
      'incoming-document:list': (data) => this.handleList(data as SearchIncomingDocumentsRequest),
      'incoming-document:next-record-info': () => this.handleNextRecordInfo(),
      'incoming-document:get-distributions': (data) => this.handleGetDistributions(data),
      'incoming-document:add-distribution': (data) =>
        this.handleAddDistribution(data as CreateDistributionRequest),
      'incoming-document:update-distribution': (data) =>
        this.handleUpdateDistribution(data as UpdateDistributionRequest),
      'incoming-document:delete-distribution': (data) => this.handleDeleteDistribution(data),
      'incoming-document:deliver-distribution': (data) =>
        this.handleDeliverDistribution(data as DeliverDistributionRequest),
      'incoming-document:courier-pending': (data) => this.handleCourierPending(data),
      'incoming-document:courier-bulk-deliver': (data) =>
        this.handleCourierBulkDeliver(data as BulkDeliverRequest),
      'incoming-document:courier-delivered-list': (data) =>
        this.handleCourierDeliveredList(data as CourierDeliveredListRequest)
    }
  }

  /** Modal açılınca: sıradaki K.No (id), bugünün tarihi, G.S.No */
  protected async handleNextRecordInfo(): Promise<ServiceResponse<NextRecordInfoResponse>> {
    const nextId = this.repository.getNextId()
    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = now.getFullYear()
    const recordDate = `${day}.${month}.${year}`
    const isoDate = `${year}-${month}-${day}`
    const daySequenceNo = this.repository.getNextDaySequenceNo(isoDate)
    return this.ok({ nextId, recordDate, daySequenceNo }, 'Kayıt bilgileri hazır')
  }

  protected async handleList(
    filters: SearchIncomingDocumentsRequest
  ): Promise<ServiceResponse<PaginatedIncomingDocumentsResponse>> {
    const page = Math.max(1, filters.page ?? 1)
    const pageSize = Math.max(20, Math.min(500, filters.pageSize ?? 20))
    const { data, total } = this.repository.searchByQueryPaginated(
      {
        id: filters.id,
        query: filters.query?.trim() || undefined
      },
      page,
      pageSize
    )
    return this.ok(
      { data, total, page, pageSize },
      total > 0 ? `${total} kayıt bulundu` : 'Kayıt bulunamadı'
    )
  }

  // ---- Dağıtım İşlemleri ----

  protected async handleGetDistributions(
    data: unknown
  ): Promise<ServiceResponse<DocumentDistribution[]>> {
    const { document_id, document_scope } = data as {
      document_id: number
      document_scope: DocumentScope
    }
    if (!document_id) throw AppError.badRequest('Evrak ID belirtilmedi')
    if (!document_scope) throw AppError.badRequest('Evrak kapsamı belirtilmedi')
    const list = this.distributionRepository.findByDocumentAndScope(document_id, document_scope)
    return this.ok(list, 'Dağıtımlar getirildi')
  }

  protected async handleAddDistribution(
    data: CreateDistributionRequest
  ): Promise<ServiceResponse<DocumentDistribution>> {
    const { document_id, document_scope, unit_id, channel_id } = data
    if (!document_id) throw AppError.badRequest('Evrak ID belirtilmedi')
    if (!document_scope) throw AppError.badRequest('Evrak kapsamı belirtilmedi')
    if (!unit_id) throw AppError.badRequest('Birlik seçimi zorunludur')
    if (!channel_id) throw AppError.badRequest('Kanal seçimi zorunludur')

    // Scope'a göre evrak varlık kontrolü (Sınıfın kendi scope'u ile validate edelim)
    if (document_scope === this.getDocumentScope()) {
      if (!this.repository.exists(document_id)) {
        throw AppError.notFound('Evrak kaydı bulunamadı')
      }
    }

    // Birliğin üst birliğini otomatik bul
    const unit = this.unitRepository.findById(unit_id)
    if (!unit) throw AppError.badRequest('Seçilen birlik bulunamadı')
    const parentUnitId = unit.parent_id

    const item = this.distributionRepository.create({
      document_id,
      document_scope,
      unit_id,
      parent_unit_id: parentUnitId,
      channel_id,
      is_delivered: false,
      delivery_date: null,
      receipt_no: null
    })

    // Kanal senet gerektirmiyorsa otomatik teslim et (Posta kanalı hariç — posta servisi modülünde teslim edilecek)
    const channel = this.channelRepository.findById(channel_id)
    if (channel && !channel.is_senet_required && channel.name.toLowerCase() !== 'posta') {
      const delivered = this.distributionRepository.markDeliveredWithoutReceipt(
        item.id,
        0,
        'Sistem'
      )
      return this.created(
        delivered ?? item,
        'Dağıtım eklendi ve teslim edildi (senet gerektirmiyor)'
      )
    }

    return this.created(item, 'Dağıtım eklendi')
  }

  protected async handleUpdateDistribution(
    data: UpdateDistributionRequest
  ): Promise<ServiceResponse<DocumentDistribution | null>> {
    const { id, ...rest } = data
    if (!id) throw AppError.badRequest('Güncellenecek dağıtım ID belirtilmedi')
    const existing = this.distributionRepository.findById(id)
    if (!existing) throw AppError.notFound('Dağıtım kaydı bulunamadı')

    // Kanal değişikliği kontrolü — Kurye ve Posta ile teslim edilmişse değiştirilemez
    if (existing.is_delivered && rest.channel_id !== undefined) {
      const currentChannel = this.channelRepository.findById(existing.channel_id)
      const lockedChannels = ['posta', 'kurye']
      if (currentChannel && lockedChannels.includes(currentChannel.name.toLowerCase())) {
        throw AppError.badRequest(
          `${currentChannel.name} ile teslim edilmiş dağıtımın kanalı değiştirilemez`
        )
      }
    }

    const fields: Record<string, unknown> = {}

    if (rest.unit_id !== undefined) {
      // Birlik değiştiğinde parent_unit_id'yi de güncelle
      const unit = this.unitRepository.findById(rest.unit_id)
      if (!unit) throw AppError.badRequest('Seçilen birlik bulunamadı')
      fields.unit_id = rest.unit_id
      fields.parent_unit_id = unit.parent_id
    }

    // Eski kanalın Posta olup olmadığını kontrol et — kanal değişirse zarftan kopar
    if (rest.channel_id !== undefined && rest.channel_id !== existing.channel_id) {
      const oldChannel = this.channelRepository.findById(existing.channel_id)
      if (oldChannel && oldChannel.name.toLowerCase() === 'posta') {
        // Posta zarfına bağlıysa bağlantıyı kaldır
        this.postalEnvelopeRepository.unlinkDistribution(id)
      }

      fields.channel_id = rest.channel_id

      // Teslim edilmiş bir dağıtımın kanalı değiştiriliyorsa teslim durumunu sıfırla
      if (existing.is_delivered) {
        fields.is_delivered = false
        fields.delivery_date = null
        fields.receipt_no = null
      }
    }

    const item = this.distributionRepository.update(id, fields)

    // Kanal değiştirildiğinde, yeni kanal senet gerektirmiyorsa otomatik teslim et (Posta kanalı hariç)
    if (rest.channel_id !== undefined) {
      const newChannel = this.channelRepository.findById(rest.channel_id)
      if (
        newChannel &&
        !newChannel.is_senet_required &&
        newChannel.name.toLowerCase() !== 'posta'
      ) {
        const delivered = this.distributionRepository.markDeliveredWithoutReceipt(id, 0, 'Sistem')
        return this.ok(delivered, 'Dağıtım güncellendi ve teslim edildi (senet gerektirmiyor)')
      }
    }

    return this.ok(item, 'Dağıtım güncellendi')
  }

  protected async handleDeleteDistribution(data: unknown): Promise<ServiceResponse<boolean>> {
    const input = data as { id: number; force_postal_delete?: boolean }
    const id = input.id
    if (!id) throw AppError.badRequest('Silinecek dağıtım ID belirtilmedi')

    const existing = this.distributionRepository.findById(id)
    if (!existing) throw AppError.notFound('Dağıtım kaydı bulunamadı')

    // Posta zarfına bağlı mı kontrol et
    const isLinkedToEnvelope = this.postalEnvelopeRepository.isDistributionLinkedToEnvelope(id)

    if (isLinkedToEnvelope && !input.force_postal_delete) {
      // Frontend'e uyarı gönder — kullanıcı onayı gerekiyor
      return {
        success: false,
        statusCode: 409,
        message: 'POSTAL_ENVELOPE_WARNING',
        data: false
      }
    }

    // Posta zarfı bağlantısını temizle (varsa)
    if (isLinkedToEnvelope) {
      this.postalEnvelopeRepository.unlinkDistribution(id)
    }

    // Dağıtımı sil
    this.distributionRepository.delete(id)
    return this.ok(true, 'Dağıtım silindi')
  }

  /** Teslim işlemi — kanalın is_senet_required değerine göre senet no üretimi */
  protected async handleDeliverDistribution(
    data: DeliverDistributionRequest
  ): Promise<ServiceResponse<DocumentDistribution | null>> {
    const { id } = data
    if (!id) throw AppError.badRequest('Teslim edilecek dağıtım ID belirtilmedi')
    const existing = this.distributionRepository.findById(id)
    if (!existing) throw AppError.notFound('Dağıtım kaydı bulunamadı')
    if (existing.is_delivered) throw AppError.badRequest('Bu dağıtım zaten teslim edilmiş')

    // Kanalın senet gerekliliğini kontrol et
    const channel = this.channelRepository.findById(existing.channel_id)
    const isSenetRequired = channel?.is_senet_required ?? true

    // Kullanıcı bilgisi (tek teslimde request'te yoksa 0/'Sistem' geçilir)
    const raw = data as unknown as Record<string, unknown>
    const userId = raw.delivered_by_user_id as number | undefined
    const userName = raw.delivered_by_name as string | undefined

    if (isSenetRequired) {
      // Atomik senet no üret (exclusive transaction)
      const receiptNo = this.receiptCounterRepository.getNextReceiptNo()
      const item = this.distributionRepository.markDelivered(
        id,
        receiptNo,
        userId ?? 0,
        userName ?? 'Sistem'
      )
      return this.ok(item, `Teslim edildi — Senet No: ${receiptNo}`)
    } else {
      // Senet gerektirmeyen kanal — senet no olmadan teslim et
      const item = this.distributionRepository.markDeliveredWithoutReceipt(
        id,
        userId ?? 0,
        userName ?? 'Sistem'
      )
      return this.ok(item, 'Teslim edildi (senet no gerektirmiyor)')
    }
  }

  // ---- Kurye İşlemleri ----

  /** Birlik ID listesine göre teslim edilmemiş kurye dağıtımlarını getir */
  protected async handleCourierPending(
    data: unknown
  ): Promise<ServiceResponse<CourierPendingDistribution[]>> {
    const { unit_ids } = data as { unit_ids: number[] }
    if (!unit_ids || !Array.isArray(unit_ids) || unit_ids.length === 0) {
      throw AppError.badRequest('En az bir birlik ID belirtilmelidir')
    }
    const list = this.distributionRepository.findPendingCourierByUnitIds(
      unit_ids,
      this.getDocumentScope(),
      this.repository['getTableName']() // protected metoda class içinden erişim
    )
    return this.ok(
      list,
      list.length > 0
        ? `${list.length} teslim edilmemiş dağıtım bulundu`
        : 'Teslim edilmemiş dağıtım bulunamadı'
    )
  }

  /** Seçilen dağıtım ID'lerini toplu teslim et */
  protected async handleCourierBulkDeliver(
    data: BulkDeliverRequest
  ): Promise<ServiceResponse<BulkDeliverResponse>> {
    const { distribution_ids, delivered_by_user_id, delivered_by_name } = data
    if (!distribution_ids || distribution_ids.length === 0) {
      throw AppError.badRequest('En az bir dağıtım ID belirtilmelidir')
    }
    if (!delivered_by_user_id || !delivered_by_name) {
      throw AppError.badRequest('Teslim eden kullanıcı bilgisi zorunludur')
    }

    const delivered: DeliveredReceiptInfo[] = []
    const failed: BulkDeliverResponse['failed'] = []

    // İlk dağıtımın kanalından senet gerekliliğini kontrol et ve
    // tek senet numarası üret — tüm belgeler aynı numarayı paylaşır
    let sharedReceiptNo: number | null = null
    const firstExisting = this.distributionRepository.findById(distribution_ids[0])
    if (firstExisting) {
      const channel = this.channelRepository.findById(firstExisting.channel_id)
      const isSenetRequired = channel?.is_senet_required ?? true
      if (isSenetRequired) {
        sharedReceiptNo = this.receiptCounterRepository.getNextReceiptNo()
      }
    }

    for (const distId of distribution_ids) {
      try {
        const existing = this.distributionRepository.findById(distId)
        if (!existing) {
          failed.push({ distribution_id: distId, reason: 'Dağıtım kaydı bulunamadı' })
          continue
        }
        if (existing.is_delivered) {
          // Çakışma — başka kullanıcı tarafından zaten teslim edilmiş
          const doc = this.repository.findById(existing.document_id)
          failed.push({
            distribution_id: distId,
            reason: 'Zaten teslim edilmiş',
            already_delivered_by: existing.delivered_by_name ?? 'Bilinmiyor',
            already_receipt_no: existing.receipt_no,
            document_id: existing.document_id,
            subject: doc?.subject ?? ''
          })
          continue
        }

        let deliveryDate: string

        if (sharedReceiptNo !== null) {
          const result = this.distributionRepository.markDelivered(
            distId,
            sharedReceiptNo,
            delivered_by_user_id,
            delivered_by_name
          )
          deliveryDate = result?.delivery_date ?? ''
        } else {
          const result = this.distributionRepository.markDeliveredWithoutReceipt(
            distId,
            delivered_by_user_id,
            delivered_by_name
          )
          deliveryDate = result?.delivery_date ?? ''
        }

        // Evrak ve birlik bilgilerini al
        const doc = this.repository.findById(existing.document_id)
        const unit = this.unitRepository.findById(existing.unit_id)

        delivered.push({
          distribution_id: distId,
          receipt_no: sharedReceiptNo,
          delivery_date: deliveryDate,
          document_id: existing.document_id,
          document_scope: existing.document_scope,
          unit_id: existing.unit_id,
          record_date: doc?.record_date ?? '',
          source_office: doc?.source_office ?? '',
          reference_number: doc?.reference_number ?? '',
          subject: doc?.subject ?? '',
          document_date: doc?.document_date ?? '',
          document_type: doc?.document_type ?? 'EVRAK',
          classification_id: doc?.classification_id ?? 0,
          security_control_no: doc?.security_control_no ?? '',
          unit_name: unit?.short_name ?? unit?.name ?? String(existing.unit_id),
          attachment_count: doc?.attachment_count ?? 0,
          page_count: doc?.page_count ?? 0,
          delivered_by_name
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
        failed.push({ distribution_id: distId, reason: message })
      }
    }

    const msg = `${delivered.length} dağıtım teslim edildi${failed.length > 0 ? `, ${failed.length} başarısız` : ''}`
    return this.ok({ delivered, failed }, msg)
  }

  /** Teslim edilmiş kurye dağıtımlarını getir (filtreleme destekli) */
  protected async handleCourierDeliveredList(
    data: CourierDeliveredListRequest
  ): Promise<ServiceResponse<DeliveredReceiptInfo[]>> {
    const { date_from, date_to, unit_ids } = data
    if (!date_from || !date_to) {
      throw AppError.badRequest('Tarih aralığı zorunludur')
    }
    const list = this.distributionRepository.findDeliveredCourier(
      date_from,
      date_to,
      unit_ids && unit_ids.length > 0 ? unit_ids : undefined,
      this.getDocumentScope(),
      this.repository['getTableName']()
    )
    return this.ok(
      list,
      list.length > 0
        ? `${list.length} teslim edilmiş kayıt bulundu`
        : 'Teslim edilmiş kayıt bulunamadı'
    )
  }
}
