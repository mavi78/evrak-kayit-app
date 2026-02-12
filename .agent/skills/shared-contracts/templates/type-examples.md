# Tip Tanımları Referans Örnekleri

Bu dosya mevcut projeden alınmış tip tanımları örneklerini içerir. Yeni modüller bu kalıpları takip etmelidir.

## Entity Tanımı — Auth Modülü Örneği

```typescript
// src/shared/types/auth.types.ts
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

/** Rol bazlı varsayılan görünürlük — kullanıcıya özel izin yoksa bu kullanılır */
export interface RoleVisibilityDefault {
  page_key: string
  can_access: boolean
}
```

## Request Tipleri — Kalıp

Her modül için aşağıdaki request tipleri tanımlanır:

```typescript
// Login özel request — TC Kimlik No + şifre
export interface LoginRequest {
  tc_kimlik_no: string
  password: string
}

// Login özel response (bileşik yanıt)
export interface LoginResponse {
  user: UserWithoutPassword
  permissions: PagePermission[]
  /** Giriş yapan kullanıcının rolüne göre varsayılan sayfa görünürlüğü */
  role_visibility_defaults: RoleVisibilityDefault[]
}

// Create request — entity'nin oluşturulabilir alanları
export interface CreateUserRequest {
  tc_kimlik_no: string
  password: string
  full_name: string
  rutbe: string
  role: UserRole
}

// Update request — id zorunlu, diğer alanlar opsiyonel
export interface UpdateUserRequest {
  id: number
  full_name?: string
  rutbe?: string
  role?: UserRole
  is_active?: boolean
}

// Şifre değiştirme — kendi (old_password zorunlu) veya başkasının (old_password yok)
export interface ChangePasswordRequest {
  user_id: number
  new_password: string
  changed_by: number
  old_password?: string  // user_id === changed_by ise zorunlu
}

export interface SetPermissionRequest {
  user_id: number
  page_key: string
  can_access: boolean
  granted_by: number
}

// Basit ID tabanlı request'ler
export interface DeleteUserRequest {
  id: number
}

export interface GetPermissionsRequest {
  user_id: number
}

// Rol bazlı sayfa yönetimi request'leri
export interface GetRolePageDefaultsRequest {
  role: Exclude<UserRole, 'system'>
}

export interface SetRolePageDefaultsRequest {
  role: Exclude<UserRole, 'system'>
  page_keys: string[]
  set_by: number
}

export interface GetAssignablePagesRequest {
  target_user_id: number
  actor_id: number
}

export interface GetAssignablePagesForRoleRequest {
  actor_id: number
  target_role: Exclude<UserRole, 'system'>
}
```

## Yeni Modül Tip Dosyası Şablonu

Aşağıdaki şablonu kopyalayıp yeni modül için uyarlayın:

```typescript
// src/shared/types/{modul}.types.ts
// ============================================================
// {Modül Adı} tip tanımları
// Boolean alanlar gerçek boolean olarak tanımlı.
// SQLite (0/1) <-> boolean dönüşümü BaseRepository'de yapılır.
// ============================================================

import type { BaseEntity } from './common.types'

// ---- Entity Tipleri ----

/** {Entity açıklaması} */
export interface YourEntity extends BaseEntity {
  title: string
  description: string
  status: YourStatus
  is_active: boolean
  created_by: number
}

/** Durum tipleri */
export type YourStatus = 'draft' | 'pending' | 'approved' | 'rejected'

// ---- Request Tipleri ----

/** Yeni kayıt oluşturma isteği */
export interface CreateYourRequest {
  title: string
  description: string
  status?: YourStatus
  created_by: number
}

/** Kayıt güncelleme isteği */
export interface UpdateYourRequest {
  id: number
  title?: string
  description?: string
  status?: YourStatus
  is_active?: boolean
  updated_by: number
}

/** Kayıt silme isteği */
export interface DeleteYourRequest {
  id: number
  deleted_by: number
}

// ---- Arama ve Filtreleme ----

/** Arama parametreleri */
export interface SearchYourRequest {
  query?: string
  status?: YourStatus
  is_active?: boolean
}

// ---- Bileşik Yanıt Tipleri (gerekirse) ----

/** Detay sayfası için zengin yanıt */
export interface YourEntityDetail extends YourEntity {
  created_by_name: string
  // İlişkili veriler
}
```

## Barrel Export Düzeni

```typescript
// src/shared/types/index.ts
// Tüm tip tanımları bu dosyadan dışa aktarılır
export * from './common.types'
export * from './auth.types'
export * from './app.types'
// Yeni modüller buraya eklenir:
// export * from './{modul}.types'
```

## Sabitler Ekleme Düzeni

```typescript
// src/shared/utils/constants.ts — Yeni sayfa anahtarı eklerken:

export const PAGE_KEYS = {
  DASHBOARD: 'dashboard',
  INCOMING_DOCUMENTS: 'incoming-documents',
  OUTGOING_DOCUMENTS: 'outgoing-documents',
  TRANSIT_DOCUMENTS: 'transit-documents',
  USER_MANAGEMENT: 'user-management',
  PAGE_MANAGEMENT: 'page-management',
  SETTINGS: 'settings',
  LOGS: 'logs',
  COURIER_DELIVERED: 'courier-delivered',
  COURIER_NOT_DELIVERED: 'courier-not-delivered',
  // YOUR_MODULE: 'your-module',  // ← Yeni modül eklerken buraya satır ekle
} as const

/** Projede gerçekten tanımlı olan (menüde/route'ta var olan) sayfa anahtarları */
export const MENU_PAGE_KEYS: readonly PageKey[] = [
  PAGE_KEYS.DASHBOARD,
  PAGE_KEYS.USER_MANAGEMENT,
  PAGE_KEYS.PAGE_MANAGEMENT,
  PAGE_KEYS.COURIER_DELIVERED,
  PAGE_KEYS.COURIER_NOT_DELIVERED
  // Yeni menü öğesi eklerken buraya da ekle
] as const

/** İzin kontrolü gerektirmeyen sayfalar (her zaman erişilebilir) */
export const PUBLIC_PAGES: readonly PageKey[] = [PAGE_KEYS.DASHBOARD] as const

/** İzin listesinde yer alan sayfalar */
export const PAGES_REQUIRING_PERMISSION: readonly PageKey[] = [
  PAGE_KEYS.USER_MANAGEMENT,
  PAGE_KEYS.PAGE_MANAGEMENT,
  PAGE_KEYS.COURIER_DELIVERED,
  PAGE_KEYS.COURIER_NOT_DELIVERED
  // Yeni izinli sayfa eklerken buraya da ekle
] as const

export const SUPERADMIN_ONLY_PAGES: readonly PageKey[] = [
  PAGE_KEYS.USER_MANAGEMENT,
  PAGE_KEYS.SETTINGS,
  PAGE_KEYS.LOGS
] as const

/** Varsayılan sayfalama */
export const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100
} as const
```
