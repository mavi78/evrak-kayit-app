// ============================================================
// Posta Pulu (PostalStamp) tipleri - Posta pulu TL tutarı
// ============================================================

import type { BaseEntity } from './common.types'

/** Posta pulu entity; TL cinsinden tutarı */
export interface PostalStamp extends BaseEntity {
  amount: number
  is_active: boolean
}

export interface CreatePostalStampRequest {
  amount: number
  is_active?: boolean
}

export interface UpdatePostalStampRequest {
  id: number
  amount?: number
  is_active?: boolean
}

export interface DeletePostalStampRequest {
  id: number
}
