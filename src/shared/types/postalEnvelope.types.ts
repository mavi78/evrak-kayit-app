// ============================================================
// Posta Zarfı (PostalEnvelope) tipleri - Evrakların zarflanması
//
// Sorumlulukları:
// 1. Zarf entity ve CRUD tipleri
// 2. Zarf-Pul ilişki tipi
// 3. Bekleyenler havuzu ve detay görünüm tipleri
// ============================================================

import type { BaseEntity } from './common.types'

/** Posta zarfı entity */
export interface PostalEnvelope extends BaseEntity {
  recipient_name: string
  rr_code: string
}

/** Zarf-Pul ilişki entity */
export interface PostalEnvelopeStamp extends BaseEntity {
  postal_envelope_id: number
  postal_stamp_id: number
  quantity: number
}

/** Pul detayı (JOIN sonucu — frontend görünümü için) */
export interface PostalEnvelopeStampDetail extends PostalEnvelopeStamp {
  stamp_amount: number
}

/** Zarf detay görünümü — zarf + pullar + evrak bilgileri */
export interface PostalEnvelopeDetail extends PostalEnvelope {
  stamps: PostalEnvelopeStampDetail[]
  distributions: PostalEnvelopeDistributionInfo[]
  total_cost: number
}

/** Zarfa ait dağıtım bilgisi (evrak + birim bilgileri) */
export interface PostalEnvelopeDistributionInfo {
  distribution_id: number
  document_id: number
  document_subject: string
  document_reference_number: string
  unit_name: string
  parent_unit_name: string | null
}

/** Bekleyenler havuzundaki dağıtım satırı */
export interface PendingPostalDistribution {
  distribution_id: number
  document_id: number
  document_subject: string
  document_reference_number: string
  document_record_date: string
  unit_id: number
  unit_name: string
  parent_unit_id: number | null
  parent_unit_name: string | null
}

// ---- Request Tipleri ----

/** Zarf-pul girişi (oluşturma isteğinde kullanılır) */
export interface EnvelopeStampInput {
  postal_stamp_id: number
  quantity: number
}

/** Zarf oluşturma isteği */
export interface CreatePostalEnvelopeRequest {
  recipient_name: string
  rr_code?: string
  distribution_ids: number[]
  stamps: EnvelopeStampInput[]
}

/** Zarf güncelleme isteği */
export interface UpdatePostalEnvelopeRequest {
  id: number
  recipient_name: string
  rr_code?: string
  stamps: EnvelopeStampInput[]
}
