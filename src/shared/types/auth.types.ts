// ============================================================
// Kimlik doğrulama ve yetkilendirme tip tanımları
// Boolean alanlar gerçek boolean olarak tanımlı.
// SQLite (0/1) <-> boolean dönüşümü BaseRepository'de yapılır.
// ============================================================

import type { BaseEntity, UserRole } from './common.types'

/** Kullanıcı entity'si */
export interface User extends BaseEntity {
  username: string
  password: string
  full_name: string
  role: UserRole
  is_active: boolean
}

/** Şifre hariç kullanıcı bilgisi - frontend'e gönderilir */
export type UserWithoutPassword = Omit<User, 'password'>

/** Sayfa erişim izni entity'si */
export interface PagePermission extends Omit<BaseEntity, 'updated_at'> {
  user_id: number
  page_key: string
  can_access: boolean
  granted_by: number
}

// ---- Request Tipleri ----

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  user: UserWithoutPassword
  permissions: PagePermission[]
}

export interface CreateUserRequest {
  username: string
  password: string
  full_name: string
  role: UserRole
}

export interface UpdateUserRequest {
  id: number
  full_name?: string
  role?: UserRole
  is_active?: boolean
}

export interface ChangePasswordRequest {
  user_id: number
  old_password: string
  new_password: string
}

export interface SetPermissionRequest {
  user_id: number
  page_key: string
  can_access: boolean
  granted_by: number
}

export interface GetPermissionsRequest {
  user_id: number
}

export interface DeleteUserRequest {
  id: number
}
