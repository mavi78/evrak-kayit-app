// ============================================================
// Ortak tip tanımları - Frontend ve Backend tarafında kullanılır
// ============================================================

/** Tüm veritabanı entity'lerinin temel alanları */
export interface BaseEntity {
  id: number
  created_at: string
  updated_at: string
}

/** Kullanıcı rolleri - system en üst yetki, silinemez ve kaldırılamaz */
export type UserRole = 'system' | 'superadmin' | 'admin' | 'user'

/** Rol hiyerarşisi - sayısal değer yükseldikçe yetki artar */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  admin: 2,
  superadmin: 3,
  system: 4
}

/** Backend servis yanıt formatı - tüm IPC çağrıları bu formatta döner */
export interface ServiceResponse<T = null> {
  success: boolean
  data: T
  message: string
  statusCode: number
}

/** Sayfalama parametreleri */
export interface PaginationParams {
  page: number
  limit: number
}

/** Sayfalı yanıt formatı */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
