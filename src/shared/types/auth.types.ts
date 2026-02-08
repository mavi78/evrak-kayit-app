// ============================================================
// Kimlik doğrulama ve yetkilendirme tip tanımları
// Boolean alanlar gerçek boolean olarak tanımlı.
// SQLite (0/1) <-> boolean dönüşümü BaseRepository'de yapılır.
// ============================================================

import type { BaseEntity, UserRole } from './common.types'

/** TC Kimlik No: tam 11 rakam */
export const TC_KIMLIK_NO_LENGTH = 11

/** Şifre kuralları: en az 8 karakter, en az bir büyük ve bir küçük harf */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_UPPERCASE_REGEX = /[A-ZÇĞİÖŞÜ]/
export const PASSWORD_LOWERCASE_REGEX = /[a-zçğıöşü]/

/** Kullanıcı entity'si */
export interface User extends BaseEntity {
  tc_kimlik_no: string
  password: string
  full_name: string
  rutbe: string
  role: UserRole
  is_active: boolean
  /** Başkası şifreyi değiştirdiyse true; kullanıcı ilk girişte şifre değiştirmek zorunda */
  must_change_password: boolean
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

/** Giriş isteği: 11 haneli TC Kimlik No ve şifre */
export interface LoginRequest {
  tc_kimlik_no: string
  password: string
}

/** Rol bazlı varsayılan görünürlük — kullanıcıya özel izin yoksa bu kullanılır */
export interface RoleVisibilityDefault {
  page_key: string
  can_access: boolean
}

export interface LoginResponse {
  user: UserWithoutPassword
  permissions: PagePermission[]
  /** Giriş yapan kullanıcının rolüne göre varsayılan sayfa görünürlüğü (hasPageAccess fallback) */
  role_visibility_defaults: RoleVisibilityDefault[]
}

export interface CreateUserRequest {
  tc_kimlik_no: string
  password: string
  full_name: string
  rutbe: string
  role: UserRole
}

export interface UpdateUserRequest {
  id: number
  full_name?: string
  rutbe?: string
  role?: UserRole
  is_active?: boolean
}

export interface ChangePasswordRequest {
  /** Şifresi değiştirilecek kullanıcı */
  user_id: number
  /** Yeni şifre (zorunlu) */
  new_password: string
  /** İşlemi yapan kullanıcı (zorunlu) */
  changed_by: number
  /** Kendi şifresini değiştirirken mevcut şifre (user_id === changed_by ise zorunlu) */
  old_password?: string
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

/**
 * Rol bazlı varsayılan sayfa seti — system tarafından atanabilir sayfalar.
 * role: superadmin | admin | user (system için tabloda kayıt yok)
 */
export interface GetRolePageDefaultsRequest {
  role: Exclude<UserRole, 'system'>
}

export interface SetRolePageDefaultsRequest {
  /** Hedef rol (superadmin, admin, user) */
  role: Exclude<UserRole, 'system'>
  /** Bu role atanacak sayfa anahtarları */
  page_keys: string[]
  /** İşlemi yapan kullanıcı (sadece system) */
  set_by: number
}

/**
 * Bir kullanıcıya atanabilir sayfalar — UI'da hangi sayfaların açılıp kapatılabileceğini göstermek için.
 */
export interface GetAssignablePagesRequest {
  /** İznin ayarlanacak hedef kullanıcı ID */
  target_user_id: number
  /** İşlemi yapacak kullanıcı ID */
  actor_id: number
}

/**
 * Hedef role atanabilir sayfalar (kullanıcı ID olmadan; rol bazlı UI için).
 * Actor'ın kendinde olan sayfaları döner (alt role açıp kapatabildiği).
 */
export interface GetAssignablePagesForRoleRequest {
  actor_id: number
  target_role: Exclude<UserRole, 'system'>
}

/**
 * Rol varsayılan görünürlüğü — superadmin/admin bir altındaki rollere varsayılan aç/kapa atar.
 * Üst rolün verdiği sayfa izinleri doğrultusunda.
 */
export interface GetRoleVisibilityDefaultsRequest {
  role: Exclude<UserRole, 'system'>
}

export interface SetRoleVisibilityDefaultsRequest {
  /** Hedef rol (superadmin: admin|user, admin: user) */
  target_role: Exclude<UserRole, 'system'>
  /** Sayfa anahtarı ve varsayılan açık/kapalı */
  defaults: RoleVisibilityDefault[]
  /** İşlemi yapan kullanıcı ID */
  actor_id: number
}

export interface DeleteUserRequest {
  id: number
}
