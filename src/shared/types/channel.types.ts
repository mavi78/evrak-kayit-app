// ============================================================
// Kanal (Channel) tipleri - Belgenin geldiği/gönderildiği kanal
// ============================================================

import type { BaseEntity } from './common.types'

/** Kanal entity; sadece bir kayıtta is_default true olabilir */
export interface Channel extends BaseEntity {
  name: string
  sort_order: number
  is_default: boolean
  is_active: boolean
}

export interface CreateChannelRequest {
  name: string
  sort_order?: number
  is_default?: boolean
  is_active?: boolean
}

export interface UpdateChannelRequest {
  id: number
  name?: string
  sort_order?: number
  is_default?: boolean
  is_active?: boolean
}
