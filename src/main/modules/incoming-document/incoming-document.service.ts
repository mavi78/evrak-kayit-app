// ============================================================
// IncomingDocumentService - Gelen evrak iş mantığı
//
// Sorumlulukları:
// 1. Kayıt no ve gün sıra no otomatik atama
// 2. Tarihi'den document_type (EVRAK/MESAJ) hesaplama
// 3. EVRAK + requires_security_number ise Güv.Kont. Nu zorunlu; MESAJ ise zorunlu değil
// 4. Havale/dağıtım CRUD
// ============================================================

import { BaseService } from '@main/core/BaseService'
import { AppError } from '@main/core/AppError'
import { IncomingDocumentRepository } from './incoming-document.repository'
import { IncomingDocumentDistributionRepository } from './incoming-document-distribution.repository'
import { ClassificationRepository } from '@main/modules/classification/classification.repository'
import { parseDocumentDateInput, isSecurityControlNoRequired, toUpperCaseTr } from '@shared/utils'
import type {
  IncomingDocument,
  IncomingDocumentDistribution,
  CreateIncomingDocumentRequest,
  UpdateIncomingDocumentRequest,
  SearchIncomingDocumentsRequest,
  PaginatedIncomingDocumentsResponse,
  NextRecordInfoResponse,
  CreateIncomingDocumentDistributionRequest,
  UpdateIncomingDocumentDistributionRequest,
  ServiceResponse
} from '@shared/types'
import type { ServiceHandlerMap } from '@main/core/types'

export class IncomingDocumentService extends BaseService<IncomingDocument> {
  protected repository: IncomingDocumentRepository
  private distributionRepository: IncomingDocumentDistributionRepository
  private classificationRepository: ClassificationRepository

  constructor() {
    super()
    this.repository = new IncomingDocumentRepository()
    this.distributionRepository = new IncomingDocumentDistributionRepository()
    this.classificationRepository = new ClassificationRepository()
  }

  getModuleName(): string {
    return 'IncomingDocumentService'
  }

  getChannelPrefix(): string {
    return 'incoming-document'
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

    const recordNo = this.repository.getNextRecordNo()
    const now = new Date()
    // Bugünün tarihi (YYYY-MM-DD formatında) - created_at ile aynı olacak
    const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const daySequenceNo = this.repository.getNextDaySequenceNo(todayDate)

    const item = this.repository.create({
      record_no: recordNo,
      // record_date geçici olarak bugünün tarihi (migration ile kaldırılacak, frontend created_at kullanır)
      record_date: todayDate,
      day_sequence_no: daySequenceNo,
      channel_id,
      source_office: toUpperCaseTr((input.source_office ?? '').trim()),
      reference_number: toUpperCaseTr((input.reference_number ?? '').trim()),
      subject: toUpperCaseTr((input.subject ?? '').trim()),
      document_date: toUpperCaseTr(documentDate),
      document_type: documentType,
      attachment_count: input.attachment_count ?? 0,
      classification_id,
      security_control_no:
        documentType === 'MESAJ' ? '' : toUpperCaseTr((input.security_control_no ?? '').trim()),
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
    if (input.source_office !== undefined)
      fields.source_office = toUpperCaseTr(input.source_office.trim())
    if (input.reference_number !== undefined)
      fields.reference_number = toUpperCaseTr(input.reference_number.trim())
    if (input.subject !== undefined) fields.subject = toUpperCaseTr(input.subject.trim())
    fields.document_date = toUpperCaseTr(documentDate)
    fields.document_type = documentType
    if (input.attachment_count !== undefined) fields.attachment_count = input.attachment_count
    if (input.classification_id !== undefined) fields.classification_id = input.classification_id
    if (documentType === 'MESAJ') {
      fields.security_control_no = ''
    } else if (input.security_control_no !== undefined) {
      fields.security_control_no =
        input.security_control_no === null ? '' : toUpperCaseTr(input.security_control_no.trim())
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
        this.handleAddDistribution(data as CreateIncomingDocumentDistributionRequest),
      'incoming-document:update-distribution': (data) =>
        this.handleUpdateDistribution(data as UpdateIncomingDocumentDistributionRequest),
      'incoming-document:delete-distribution': (data) => this.handleDeleteDistribution(data)
    }
  }

  /** Modal açılınca: sıradaki K.No, bugünün tarihi, G.S.No */
  private async handleNextRecordInfo(): Promise<ServiceResponse<NextRecordInfoResponse>> {
    const recordNo = this.repository.getNextRecordNo()
    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = now.getFullYear()
    const recordDate = `${day}.${month}.${year}`
    const isoDate = `${year}-${month}-${day}`
    const daySequenceNo = this.repository.getNextDaySequenceNo(isoDate)
    return this.ok({ recordNo, recordDate, daySequenceNo }, 'Kayıt bilgileri hazır')
  }

  private async handleList(
    filters: SearchIncomingDocumentsRequest
  ): Promise<ServiceResponse<PaginatedIncomingDocumentsResponse>> {
    const page = Math.max(1, filters.page ?? 1)
    const pageSize = Math.max(20, Math.min(500, filters.pageSize ?? 20))
    const { data, total } = this.repository.searchByQueryPaginated(
      {
        recordNo: filters.recordNo,
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

  private async handleGetDistributions(
    data: unknown
  ): Promise<ServiceResponse<IncomingDocumentDistribution[]>> {
    const { incoming_document_id } = data as { incoming_document_id: number }
    if (!incoming_document_id) throw AppError.badRequest('Evrak ID belirtilmedi')
    const list = this.distributionRepository.findByIncomingDocumentId(incoming_document_id)
    return this.ok(list, 'Dağıtımlar getirildi')
  }

  private async handleAddDistribution(
    data: CreateIncomingDocumentDistributionRequest
  ): Promise<ServiceResponse<IncomingDocumentDistribution>> {
    const { incoming_document_id, unit_id } = data
    if (!incoming_document_id) throw AppError.badRequest('Evrak ID belirtilmedi')
    if (!unit_id) throw AppError.badRequest('Birlik seçimi zorunludur')
    if (!this.repository.exists(incoming_document_id)) {
      throw AppError.notFound('Gelen evrak kaydı bulunamadı')
    }
    const item = this.distributionRepository.create({
      incoming_document_id,
      unit_id,
      distribution_type: toUpperCaseTr((data.distribution_type ?? '').trim()),
      delivery_date: toUpperCaseTr((data.delivery_date ?? '').trim()),
      receipt_no: toUpperCaseTr((data.receipt_no ?? '').trim())
    })
    return this.created(item, 'Havale/dağıtım eklendi')
  }

  private async handleUpdateDistribution(
    data: UpdateIncomingDocumentDistributionRequest
  ): Promise<ServiceResponse<IncomingDocumentDistribution | null>> {
    const { id, ...rest } = data
    if (!id) throw AppError.badRequest('Güncellenecek dağıtım ID belirtilmedi')
    if (!this.distributionRepository.exists(id)) throw AppError.notFound('Dağıtım kaydı bulunamadı')
    const fields: Record<string, unknown> = {}
    if (rest.unit_id !== undefined) fields.unit_id = rest.unit_id
    if (rest.distribution_type !== undefined)
      fields.distribution_type = toUpperCaseTr(rest.distribution_type.trim())
    if (rest.delivery_date !== undefined)
      fields.delivery_date = toUpperCaseTr(rest.delivery_date.trim())
    if (rest.receipt_no !== undefined) fields.receipt_no = toUpperCaseTr(rest.receipt_no.trim())
    const item = this.distributionRepository.update(id, fields)
    return this.ok(item, 'Dağıtım güncellendi')
  }

  private async handleDeleteDistribution(data: unknown): Promise<ServiceResponse<boolean>> {
    const { id } = this.requireId(data)
    if (!this.distributionRepository.exists(id)) throw AppError.notFound('Dağıtım kaydı bulunamadı')
    this.distributionRepository.delete(id)
    return this.ok(true, 'Dağıtım silindi')
  }
}
