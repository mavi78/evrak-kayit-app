---
name: backend-architecture
description: Electron Main Process backend geliştirme rehberi. Repository-Service-IPC katmanlı mimari, modül oluşturma, veritabanı işlemleri, hata yönetimi ve güvenlik kalıpları. Backend kodu yazarken, yeni modül eklerken veya veritabanı işlemleri yaparken kullanılır.
---

# Backend Architecture (Electron Main Process)

Katmanlı mimari: Repository → Service → IPC → Frontend. Her katmanın tek sorumluluğu vardır.

## Mimari Genel Bakış

```
ServiceManager (IPC kayıt)
  └── BaseService<T> (iş mantığı + IPC handler)
        └── BaseRepository<T> (veri erişim + CRUD)
              └── Database (singleton SQLite bağlantısı)

Yardımcılar: AppError (hata), Logger (loglama)
```

## Yeni Modül Ekleme İş Akışı

Yeni bir backend modülü eklerken **bu sırayla** ilerleyin:

### Adım 1: Shared Types (önce tipler)

`src/shared/types/{modul}.types.ts` dosyasını oluşturup `index.ts`'e ekleyin. Detaylar için [shared-contracts skill](../shared-contracts/SKILL.md) kullanın.

### Adım 2: Repository Oluştur

```typescript
// src/main/modules/{modul-adi}/{modul-adi}.repository.ts
import { BaseRepository } from '@main/core/BaseRepository'
import type { YourEntity } from '@shared/types'

export class YourRepository extends BaseRepository<YourEntity> {
  // Boolean kolonlar varsa tanımla
  private readonly customBoolCols = ['is_completed'] as const

  protected getTableName(): string {
    return 'your_table'
  }

  protected override getBooleanColumns(): readonly string[] {
    return ['is_active']  // SQLite 0/1 <-> boolean dönüşümü
  }

  protected getTableSchemas(): readonly string[] {
    return [
      `CREATE TABLE IF NOT EXISTS your_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      )`
    ]
  }

  // Özel sorgular — her zaman safeExecute içinde
  findByTitle(title: string): YourEntity | null {
    return this.findOneBy('title', title)
  }
}
```

### Adım 3: Service Oluştur

```typescript
// src/main/modules/{modul-adi}/{modul-adi}.service.ts
import { BaseService } from '@main/core/BaseService'
import { AppError } from '@main/core/AppError'
import { YourRepository } from './{modul-adi}.repository'
import type { ServiceResponse, YourEntity, CreateYourRequest } from '@shared/types'
import type { ServiceHandlerMap } from '@main/core/types'

export class YourService extends BaseService<YourEntity> {
  protected repository: YourRepository

  constructor() {
    super()
    this.repository = new YourRepository()
  }

  getModuleName(): string {
    return 'YourService'
  }

  getChannelPrefix(): string {
    return 'your-module'  // IPC kanalı: your-module:get-all, your-module:create, vb.
  }

  // Standart CRUD'u override et (validasyon ekle)
  protected override async handleCreate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as CreateYourRequest
    if (!input.title?.trim()) throw AppError.badRequest('Başlık zorunludur')
    const item = this.repository.create({ title: input.title.trim(), is_active: true })
    return this.created(item, 'Kayıt oluşturuldu')
  }

  // Özel IPC kanalları
  protected override getCustomHandlers(): ServiceHandlerMap {
    return {
      'your-module:search': (data) => this.search(data as { query: string }),
    }
  }

  private async search(data: { query: string }): Promise<ServiceResponse<YourEntity[]>> {
    const results = this.repository.findByTitle(data.query)
    return this.ok(results ? [results] : [], 'Arama tamamlandı')
  }
}
```

### Adım 4: ServiceManager'a Kaydet

```typescript
// src/main/index.ts — initializeServices() içine ekle
serviceManager.register(new YourService())
```

### Adım 5: Frontend Entegrasyonu

`src/renderer/src/lib/api.ts` dosyasına API fonksiyonları ekleyin. Detaylar için [frontend-architecture skill](../frontend-architecture/SKILL.md) kullanın.

---

## Temel Sınıflar Referansı

### BaseRepository<T> — Miras Alınan Özellikler

| Metod | Açıklama | Override? |
|-------|----------|-----------|
| `getTableName()` | Tablo adı | **Zorunlu** |
| `getTableSchemas()` | CREATE TABLE SQL'leri | **Zorunlu** |
| `getBooleanColumns()` | Boolean kolon listesi | Gerekirse |
| `findAll()` | Tüm kayıtlar (DESC) | Nadiren |
| `findById(id)` | ID ile tek kayıt | Nadiren |
| `findBy(col, val)` | Kolona göre çoklu kayıt | Hayır |
| `findOneBy(col, val)` | Kolona göre tek kayıt | Hayır |
| `create(data)` | Yeni kayıt oluştur | Hayır |
| `update(id, data)` | Kayıt güncelle (+updated_at) | Hayır |
| `delete(id)` | Kayıt sil | Hayır |
| `exists(id)` | Var mı kontrolü | Hayır |
| `count()` | Toplam kayıt sayısı | Hayır |
| `safeExecute(fn)` | Güvenli DB işlemi | Hayır |
| `safeTransaction(fn)` | Atomik transaction | Hayır |

### BaseService<T> — Miras Alınan Özellikler

| Metod | Açıklama | Override? |
|-------|----------|-----------|
| `getModuleName()` | Modül adı (log için) | **Zorunlu** |
| `getChannelPrefix()` | IPC kanal öneki | **Zorunlu** |
| `handleGetAll()` | `{prefix}:get-all` handler | Gerekirse |
| `handleGetById(data)` | `{prefix}:get-by-id` handler | Nadiren |
| `handleCreate(data)` | `{prefix}:create` handler | Sıklıkla (validasyon) |
| `handleUpdate(data)` | `{prefix}:update` handler | Sıklıkla (validasyon) |
| `handleDelete(data)` | `{prefix}:delete` handler | Gerekirse |
| `getCustomHandlers()` | Özel IPC kanalları ekle | Sıklıkla |
| `ok(data, msg)` | 200 yanıt oluştur | Hayır |
| `created(data, msg)` | 201 yanıt oluştur | Hayır |
| `fail(msg, code)` | Hata yanıtı oluştur | Hayır |
| `requireId(data)` | ID doğrulama | Hayır |

---

## Hata Yönetimi Kalıpları

```typescript
// ✅ Her zaman AppError kullan
throw AppError.badRequest('Geçersiz veri')        // 400
throw AppError.unauthorized('Giriş yapılmadı')    // 401
throw AppError.forbidden('Yetkiniz yok')           // 403
throw AppError.notFound('Kayıt bulunamadı')        // 404
throw AppError.conflict('Zaten mevcut')            // 409
throw AppError.internal('Sunucu hatası')           // 500
throw AppError.busy('DB meşgul')                   // 503

// ❌ YASAK
throw new Error('...')
console.error('...')
```

### DB Hata Çevirisi (Otomatik)

BaseRepository `safeExecute` içinde SQLite hatalarını otomatik çevirir:

| SQLite Hatası | AppError | Kod |
|---------------|----------|-----|
| UNIQUE constraint | `conflict()` | 409 |
| FOREIGN KEY constraint | `badRequest()` | 400 |
| NOT NULL constraint | `badRequest()` | 400 |
| CHECK constraint | `badRequest()` | 400 |
| SQLITE_BUSY / locked | `busy()` | 503 |
| Diğer | `internal()` | 500 |

---

## Güvenlik Kontrol Listesi

- [ ] Şifreler `bcryptjs` ile hashlenmiş (SALT_ROUNDS = 10)
- [ ] Yanıtlarda şifre alanı `stripPassword()` ile çıkarılmış
- [ ] Rol hiyerarşisi kontrol edilmiş (superadmin > admin > user)
- [ ] State-changing işlemlerde audit log yazılmış
- [ ] SQL sorgularında parameterized query (`?`) kullanılmış
- [ ] Boolean alanlar `getBooleanColumns()` ile tanımlı

---

## Loglama

```typescript
// Her zaman Logger singleton kullan
this.logger.info('Mesaj', 'KontekstAdı')
this.logger.warn('Uyarı', 'KontekstAdı')
this.logger.error('Hata', errorObj, 'KontekstAdı')
this.logger.debug('Debug bilgisi', 'KontekstAdı')
```

---

## Dosya Başlık Şablonu

```typescript
// ============================================================
// DosyaAdı - Kısa açıklama (Türkçe)
//
// Sorumlulukları:
// 1. ...
// 2. ...
// ============================================================
```

---

## Detaylı Referanslar

- Mevcut AuthService örneği için: [templates/auth-example.md](templates/auth-example.md)
- Veritabanı şema tasarım kuralları için: [templates/database-patterns.md](templates/database-patterns.md)
