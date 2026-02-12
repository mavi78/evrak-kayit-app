// ============================================================
// Gelen evrak (IncomingDocument) tipleri
// document_type: Tarihi alanına göre otomatik (EVRAK: DD.MM.YYYY, MESAJ: ZULU format)
// ============================================================

import type { BaseEntity } from './common.types'

/** Belge türü — Tarihi formatına göre sistem tarafından atanır */
export type DocumentType = 'EVRAK' | 'MESAJ'

/** Belge kapsamı — hangi sayfadan/modülden çağrıldığını belirtir */
export type DocumentScope = 'INCOMING' | 'OUTGOING' | 'TRANSIT'

/** Modal açıldığında gösterilecek otomatik kayıt bilgileri */
export interface NextRecordInfoResponse {
  /** Sıradaki kayıt numarası */
  recordNo: number
  /** Bugünün tarihi (GG.AA.YYYY) */
  recordDate: string
  /** Bugünkü gün sıra numarası */
  daySequenceNo: number
}

/** Gelen evrak ana kaydı */
export interface IncomingDocument extends BaseEntity {
  record_no: number
  record_date: string
  day_sequence_no: number
  channel_id: number
  source_office: string
  reference_number: string
  subject: string
  /** Evrak tarihi (EVRAK: YYYY-MM-DD, MESAJ: ham metin örn. 101842Z FEB 26) */
  document_date: string
  /** Sistem tarafından Tarihi formatına göre atanır */
  document_type: DocumentType
  attachment_count: number
  classification_id: number
  security_control_no: string
  page_count: number
  category_id: number
  folder_id: number
}

/** Havale / dağıtım kaydı (evrak-birlik eşleşmesi) */
export interface IncomingDocumentDistribution extends BaseEntity {
  incoming_document_id: number
  unit_id: number
  distribution_type: string
  delivery_date: string
  receipt_no: string
}

/** Tarihi alanından çıkarılan sonuç (frontend/backend ortak) */
export interface DocumentDateParseResult {
  type: DocumentType
  /** EVRAK: YYYY-MM-DD, MESAJ: ham metin */
  dateValue: string
}

/** Oluşturma isteği — Kayıt tarihi backend'de created_at ile atanır; document_type backend'de hesaplanır */
export interface CreateIncomingDocumentRequest {
  channel_id: number
  source_office: string
  reference_number: string
  subject: string
  /** Kullanıcı girişi: DD.MM.YYYY (EVRAK) veya 101842Z FEB 26 (MESAJ) */
  document_date_input: string
  attachment_count?: number
  classification_id: number
  security_control_no?: string
  page_count?: number
  category_id: number
  folder_id: number
}

/** Güncelleme isteği — Kayıt tarihi (created_at) güncellenmez */
export interface UpdateIncomingDocumentRequest {
  id: number
  channel_id?: number
  source_office?: string
  reference_number?: string
  subject?: string
  document_date_input?: string
  attachment_count?: number
  classification_id?: number
  security_control_no?: string
  page_count?: number
  category_id?: number
  folder_id?: number
}

/** Arama — K.No ayrı filtre, genel metin diğer sütunlarda, sayfalama */
export interface SearchIncomingDocumentsRequest {
  /** K.No ile tam eşleşme (ayrı textbox) */
  recordNo?: number
  /** Makam, sayı, konu, tarih vb. genel arama */
  query?: string
  /** Sayfa numarası (1 tabanlı) */
  page?: number
  /** Sayfa boyutu (min 20) */
  pageSize?: number
}

/** Sayfalanmış liste yanıtı */
export interface PaginatedIncomingDocumentsResponse {
  data: IncomingDocument[]
  total: number
  page: number
  pageSize: number
}

/** Havale/dağıtım ekleme */
export interface CreateIncomingDocumentDistributionRequest {
  incoming_document_id: number
  unit_id: number
  distribution_type: string
  delivery_date: string
  receipt_no: string
}

/** Havale/dağıtım güncelleme */
export interface UpdateIncomingDocumentDistributionRequest {
  id: number
  unit_id?: number
  distribution_type?: string
  delivery_date?: string
  receipt_no?: string
}
