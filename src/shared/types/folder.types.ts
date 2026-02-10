// ============================================================
// Klasör (Folder) tipleri - Belgenin kaldırıldığı dosya
// ============================================================

import type { BaseEntity } from './common.types'

/** Klasör entity; sadece bir kayıtta is_default true olabilir */
export interface Folder extends BaseEntity {
  name: string
  sort_order: number
  is_default: boolean
  is_active: boolean
}

export interface CreateFolderRequest {
  name: string
  sort_order?: number
  is_default?: boolean
  is_active?: boolean
}

export interface UpdateFolderRequest {
  id: number
  name?: string
  sort_order?: number
  is_default?: boolean
  is_active?: boolean
}
