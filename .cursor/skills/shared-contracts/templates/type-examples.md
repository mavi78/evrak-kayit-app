# Tip Tanımları Referans Örnekleri

Bu dosya mevcut projeden alınmış tip tanımları örneklerini içerir. Yeni modüller bu kalıpları takip etmelidir.

## Entity Tanımı — Auth Modülü Örneği

```typescript
// src/shared/types/auth.types.ts
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
```

## Request Tipleri — Kalıp

Her modül için aşağıdaki request tipleri tanımlanır:

```typescript
// Login özel request
export interface LoginRequest {
  username: string
  password: string
}

// Login özel response (bileşik yanıt)
export interface LoginResponse {
  user: UserWithoutPassword
  permissions: PagePermission[]
}

// Create request — entity'nin oluşturulabilir alanları
export interface CreateUserRequest {
  username: string
  password: string
  full_name: string
  role: UserRole
}

// Update request — id zorunlu, diğer alanlar opsiyonel
export interface UpdateUserRequest {
  id: number
  full_name?: string
  role?: UserRole
  is_active?: boolean
}

// Özel işlem request'leri
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

// Basit ID tabanlı request'ler
export interface DeleteUserRequest {
  id: number
}

export interface GetPermissionsRequest {
  user_id: number
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
// Yeni modüller buraya eklenir:
// export * from './{modul}.types'
```

## Sabitler Ekleme Düzeni

```typescript
// src/shared/utils/constants.ts — Yeni sayfa anahtarı eklerken:

export const PAGE_KEYS = {
  DASHBOARD: 'dashboard',
  // ... mevcut anahtarlar ...
  YOUR_MODULE: 'your-module',  // ← Yeni satır
} as const

// Gerekirse erişim kurallarına ekle:
export const PUBLIC_PAGES: readonly PageKey[] = [PAGE_KEYS.DASHBOARD] as const

export const SUPERADMIN_ONLY_PAGES: readonly PageKey[] = [
  PAGE_KEYS.USER_MANAGEMENT,
  PAGE_KEYS.SETTINGS,
  PAGE_KEYS.LOGS
] as const
```
