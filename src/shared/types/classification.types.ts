// ============================================================
// Gizlilik derecesi (Classification) tipleri - Belge gizlilik seviyesi
// ============================================================

import type { BaseEntity } from './common.types'

/** Gizlilik derecesi entity; sadece bir kayıtta is_default true olabilir */
export interface Classification extends BaseEntity {
  name: string
  short_name: string
  requires_security_number: boolean
  sort_order: number
  is_default: boolean
  is_active: boolean
}

export interface CreateClassificationRequest {
  name: string
  short_name: string
  requires_security_number?: boolean
  sort_order?: number
  is_default?: boolean
  is_active?: boolean
}

export interface UpdateClassificationRequest {
  id: number
  name?: string
  short_name?: string
  requires_security_number?: boolean
  sort_order?: number
  is_default?: boolean
  is_active?: boolean
}
