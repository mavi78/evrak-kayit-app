---
name: shared-contracts
description: Frontend-Backend arası ortak tip tanımları, IPC iletişim kuralları, Preload bridge ve sabitler rehberi. Yeni modül tipi tanımlarken, IPC kanalı eklerken veya shared utils düzenlerken kullanılır.
---

# Shared Contracts (Ortak Tipler & IPC İletişim)

Frontend ve Backend arasındaki sözleşme katmanı. Tip güvenliği, IPC kuralları ve paylaşılan sabitler.

## Klasör Yapısı

```
src/shared/
├── types/
│   ├── common.types.ts     # BaseEntity, ServiceResponse, UserRole, Pagination
│   ├── auth.types.ts       # User, LoginRequest, PagePermission, vb.
│   ├── {modul}.types.ts    # Her modül kendi tip dosyasına sahip
│   └── index.ts            # Barrel export (tüm tipler)
└── utils/
    ├── constants.ts        # PAGE_KEYS, STATUS_CODES, PUBLIC_PAGES, vb.
    └── index.ts            # Barrel export (tüm utils)
```

---

## Yeni Modül Tip Tanımlama İş Akışı

### Adım 1: Tip Dosyası Oluştur

```typescript
// src/shared/types/{modul}.types.ts
import type { BaseEntity } from './common.types'

/** Ana entity */
export interface YourEntity extends BaseEntity {
  title: string
  description: string
  status: YourStatus
  is_active: boolean
  owner_id: number
}

/** Durum enum tipi */
export type YourStatus = 'draft' | 'pending' | 'approved' | 'rejected'

// ---- Request Tipleri ----

export interface CreateYourRequest {
  title: string
  description: string
  status?: YourStatus
}

export interface UpdateYourRequest {
  id: number
  title?: string
  description?: string
  status?: YourStatus
  is_active?: boolean
}

export interface DeleteYourRequest {
  id: number
}

// ---- İhtiyaca göre ek tipler ----

export interface SearchYourRequest {
  query: string
  status?: YourStatus
}
```

### Adım 2: Barrel Export'a Ekle

```typescript
// src/shared/types/index.ts
export * from './common.types'
export * from './auth.types'
export * from './{modul}.types'  // ← Yeni satır ekle
```

### Adım 3: Sabitlere Ekle (Gerekirse)

```typescript
// src/shared/utils/constants.ts — PAGE_KEYS'e yeni sayfa anahtarı ekle
export const PAGE_KEYS = {
  // ... mevcut anahtarlar ...
  YOUR_MODULE: 'your-module',
} as const
```

---

## Temel Ortak Tipler

### BaseEntity — Tüm entity'lerin temeli

```typescript
interface BaseEntity {
  id: number
  created_at: string
  updated_at: string
}
```

Her yeni entity **zorunlu** olarak `BaseEntity`'den extend eder.

### ServiceResponse<T> — Tüm IPC yanıtlarının formatı

```typescript
interface ServiceResponse<T = null> {
  success: boolean
  data: T
  message: string
  statusCode: number
}
```

**Kurallar:**
- Her IPC yanıtı bu formatta olmalı, istisnasız
- Başarılı: `{ success: true, data: T, message: '...', statusCode: 200|201 }`
- Hata: `{ success: false, data: null, message: '...', statusCode: 4xx|5xx }`
- Ham veri (string, number, array) doğrudan döndürülmez

### UserRole & ROLE_HIERARCHY

```typescript
type UserRole = 'superadmin' | 'admin' | 'user'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  admin: 2,
  superadmin: 3
}
```

### PaginationParams & PaginatedResponse

```typescript
interface PaginationParams {
  page: number
  limit: number
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
```

---

## IPC Kanal Adlandırma Kuralları

### Format: `{modul}:{aksiyon}`

| Kural | Doğru | Yanlış |
|-------|-------|--------|
| Kebab-case | `auth:get-all` | `auth:getAll`, `AUTH:GET_ALL` |
| Modül tekil | `document:create` | `documents:create` |
| Aksiyon fiil ile | `auth:login` | `auth:loginPage` |
| Standart CRUD | `{m}:get-all`, `{m}:get-by-id`, `{m}:create`, `{m}:update`, `{m}:delete` | `{m}:list`, `{m}:fetch` |

### Standart CRUD Kanalları (BaseService otomatik oluşturur)

```
{prefix}:get-all      → handleGetAll()
{prefix}:get-by-id    → handleGetById(data)
{prefix}:create       → handleCreate(data)
{prefix}:update       → handleUpdate(data)
{prefix}:delete       → handleDelete(data)
```

### Özel Kanallar (getCustomHandlers ile eklenir)

```
auth:login             → login özel işlemi
auth:change-password   → şifre değiştirme
auth:set-permission    → izin ayarlama
auth:get-permissions   → izinleri getir
auth:get-current-user  → oturumdaki kullanıcı
```

---

## Sabitler Referansı

### PAGE_KEYS — Sayfa Anahtarları

```typescript
const PAGE_KEYS = {
  DASHBOARD: 'dashboard',
  INCOMING_DOCUMENTS: 'incoming-documents',
  OUTGOING_DOCUMENTS: 'outgoing-documents',
  TRANSIT_DOCUMENTS: 'transit-documents',
  USER_MANAGEMENT: 'user-management',
  SETTINGS: 'settings',
  LOGS: 'logs',
  COURIER_DELIVERED: 'courier-delivered',
  COURIER_NOT_DELIVERED: 'courier-not-delivered'
} as const

type PageKey = (typeof PAGE_KEYS)[keyof typeof PAGE_KEYS]
```

### Erişim Kuralları

| Sabit | Açıklama | Sayfalar |
|-------|----------|----------|
| `PUBLIC_PAGES` | Herkes erişebilir | dashboard, courier-delivered, courier-not-delivered |
| `SUPERADMIN_ONLY_PAGES` | Sadece superadmin | user-management, settings, logs |
| Diğer | İzin tablosundan kontrol | incoming/outgoing/transit docs |

### STATUS_CODES

```typescript
const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const
```

---

## Preload Bridge Kuralları

Preload script **dokunulmaz** — generic `invoke()` pattern ile çalışır:

```typescript
// src/preload/index.ts — Değişiklik yapılmaz!
const api = {
  invoke: <T>(channel: string, data?: unknown): Promise<T> =>
    ipcRenderer.invoke(channel, data),
  on: (channel, callback) => ipcRenderer.on(channel, (_e, ...args) => callback(...args)),
  off: (channel, callback) => ipcRenderer.removeListener(channel, callback)
}
```

### Güvenlik Kuralları

- `contextIsolation: true` — Her zaman açık
- `nodeIntegration: false` — Her zaman kapalı
- Preload'da iş mantığı YASAK
- Preload'da Node.js API (fs, path, child_process) expose etmek YASAK

---

## Tip Tanımlama Kuralları

### Zorunlu

- `any` kullanımı **kesinlikle yasak** — `unknown` + type guard kullan
- Tüm fonksiyonlarda açık dönüş tipi belirt (`: void`, `: Promise<T>`, vb.)
- Entity tipi `BaseEntity`'den extend et
- Request/Response tipleri ayrı tanımla (entity'ye bağlama)

### Boolean Alanlar

```typescript
// Shared type'da gerçek boolean tanımla
interface YourEntity extends BaseEntity {
  is_active: boolean  // ← TypeScript boolean
}

// Repository'de SQLite dönüşümü otomatik yapılır
// getBooleanColumns() → ['is_active']
// toAppModel: 0/1 → true/false
// toDbModel: true/false → 0/1
```

### Omit Tipi Kullanımı

```typescript
// Hassas alanları çıkarmak için
type UserWithoutPassword = Omit<User, 'password'>

// BaseEntity alanlarını değiştirmek için
interface PagePermission extends Omit<BaseEntity, 'updated_at'> {
  // updated_at yok, ama id ve created_at var
}
```

---

## Yeni Modül Ekleme Tam Kontrol Listesi

Yeni bir modül eklerken **sırasıyla** tamamlayın:

- [ ] **1.** `src/shared/types/{modul}.types.ts` → Entity, Request, Response tipleri
- [ ] **2.** `src/shared/types/index.ts` → Barrel export'a ekle
- [ ] **3.** `src/shared/utils/constants.ts` → PAGE_KEYS'e sayfa anahtarı ekle (gerekirse)
- [ ] **4.** `src/main/modules/{modul}/` → Repository + Service oluştur
- [ ] **5.** `src/main/index.ts` → `serviceManager.register(new YourService())`
- [ ] **6.** `src/renderer/src/lib/api.ts` → API fonksiyonları ekle
- [ ] **7.** `src/renderer/src/pages/{modul}/` → Sayfa bileşeni oluştur
- [ ] **8.** `src/renderer/src/router/routes.ts` → Route tanımı ekle
- [ ] **9.** `src/renderer/src/components/layout/AppSidebar.tsx` → İkon eşleştirmesi ekle
- [ ] **10.** `npx tsc --noEmit` → Tip hatası kontrolü
- [ ] **11.** `npx eslint .` → Lint kontrolü

---

## TypeScript Yapılandırma Referansı

### Path Alias'lar

| Alias | Hedef | Kullanım Yeri |
|-------|-------|---------------|
| `@shared/*` | `src/shared/*` | Main, Preload, Renderer |
| `@main/*` | `src/main/*` | Sadece Main Process |
| `@renderer/*` | `src/renderer/src/*` | Sadece Renderer |

### Config Dosyaları

| Dosya | Kapsam |
|-------|--------|
| `tsconfig.json` | Root (project references) |
| `tsconfig.node.json` | Main + Preload + Shared |
| `tsconfig.web.json` | Renderer + Shared |

---

## Detaylı Referanslar

- Mevcut tip tanımları örneği: [templates/type-examples.md](templates/type-examples.md)
