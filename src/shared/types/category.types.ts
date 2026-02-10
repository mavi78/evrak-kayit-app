// ============================================================
// Kategori (Category) tipleri - Belgenin arşivlendiği kategori
// ============================================================

import type { BaseEntity } from './common.types'

/** Kategori entity; saklanma yılı ve sadece bir kayıtta is_default true */
export interface Category extends BaseEntity {
  name: string
  retention_years: number
  sort_order: number
  is_default: boolean
  is_active: boolean
}

export interface CreateCategoryRequest {
  name: string
  retention_years?: number
  sort_order?: number
  is_default?: boolean
  is_active?: boolean
}

export interface UpdateCategoryRequest {
  id: number
  name?: string
  retention_years?: number
  sort_order?: number
  is_default?: boolean
  is_active?: boolean
}
