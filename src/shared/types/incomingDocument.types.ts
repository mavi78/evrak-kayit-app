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
  /** Sıradaki kayıt numarası (id) */
  nextId: number
  /** Bugünün tarihi (GG.AA.YYYY) */
  recordDate: string
  /** Bugünkü gün sıra numarası */
  daySequenceNo: number
}

/** Gelen evrak ana kaydı */
export interface IncomingDocument extends BaseEntity {
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

/** Dağıtım kaydı (3 sayfa ortak: INCOMING/OUTGOING/TRANSIT) */
export interface DocumentDistribution extends BaseEntity {
  document_id: number
  document_scope: DocumentScope
  unit_id: number
  parent_unit_id: number | null
  channel_id: number
  is_delivered: boolean
  delivery_date: string | null
  receipt_no: number | null
  postal_envelope_id: number | null
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
  /** ISO formatında gerçek tarih (backend'de tarih sorguları için) */
  document_date?: string
  attachment_count?: number
  classification_id: number
  security_control_no?: string | null
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
  document_date?: string
  attachment_count?: number
  classification_id?: number
  security_control_no?: string | null
  page_count?: number
  category_id?: number
  folder_id?: number
}

/** Arama — K.No (id) ayrı filtre, genel metin diğer sütunlarda, sayfalama */
export interface SearchIncomingDocumentsRequest {
  /** K.No (id) ile tam eşleşme (ayrı textbox) */
  id?: number
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

// ---- Dağıtım Request Tipleri ----

/** Dağıtım ekleme — parent_unit_id backend'de otomatik atanır */
export interface CreateDistributionRequest {
  document_id: number
  document_scope: DocumentScope
  unit_id: number
  channel_id: number
}

/** Dağıtım güncelleme */
export interface UpdateDistributionRequest {
  id: number
  unit_id?: number
  channel_id?: number
}

/** Teslim işlemi — senet no atomik üretilir, geri alınamaz */
export interface DeliverDistributionRequest {
  id: number
}
