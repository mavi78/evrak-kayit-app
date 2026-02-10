// ============================================================
// Birlik (Unit) tipleri - Belge dağıtımı için birlik yapısı
// ============================================================

import type { BaseEntity } from './common.types'

/** Birlik entity — hiyerarşik (parent_id NULL = üst birlik) */
export interface Unit extends BaseEntity {
  name: string
  short_name: string
  parent_id: number | null
  sort_order: number
  is_active: boolean
}

export interface CreateUnitRequest {
  name: string
  short_name: string
  parent_id?: number | null
  sort_order?: number
  is_active?: boolean
}

export interface UpdateUnitRequest {
  id: number
  name?: string
  short_name?: string
  parent_id?: number | null
  sort_order?: number
  is_active?: boolean
}

/** Birlik hiyerarşi güncelleme (drag & drop için) */
export interface UpdateUnitHierarchyRequest {
  id: number
  parent_id: number | null
  sort_order?: number
}

/** Birlik sıralama güncelleme (aynı hiyerarşideki birlikler için) */
export interface UpdateUnitSortOrderRequest {
  items: Array<{ id: number; sort_order: number }>
}
