---
description: Backend servis ve repository oluşturma iş akışı — Electron Main Process modül geliştirme
---

# Backend Servis ve Repository Oluşturma

Yeni bir backend modülü oluştururken aşağıdaki adımlar takip edilir.

## 1. Modül Klasörünü Oluştur

- `src/main/modules/{modul-adi}/` klasörünü oluştur
- Klasör adı **kebab-case** formatında

## 2. Repository Oluştur

`{modul-adi}.repository.ts` dosyası:

- `BaseRepository<T>` sınıfından türet
- `getTableName()` — tablo adını döner (zorunlu)
- `getTableSchemas()` — tablo şemasını döner (zorunlu)
- `getBooleanColumns()` — boolean sütun varsa override et (zorunlu)
- Tüm DB sorguları `safeExecute()` veya `safeTransaction()` içinde
- SQL injection koruması: **parameterized query** (`?`) kullan
- ORM/Query Builder yasak — proje standardı better-sqlite3 raw SQL

```typescript
// Zorunlu şablon
export class {Modul}Repository extends BaseRepository<{Modul}> {
  protected getTableName(): string {
    return '{tablo_adi}'
  }
  protected getTableSchemas(): readonly string[] {
    return [SCHEMA]
  }
  protected getBooleanColumns(): readonly string[] {
    return [] // boolean alanlar (is_active, is_default vb.) varsa buraya ekle — BaseRepository dönüşüm için kullanır
  }
}
```

## 3. Service Oluştur

`{modul-adi}.service.ts` dosyası:

- `BaseService<T>` sınıfından türet
- `getModuleName()` — modül adını döner (zorunlu)
- `getChannelPrefix()` — IPC kanal önekini döner (zorunlu)
- Standart CRUD: `handleCreate`, `handleUpdate`, `handleDelete` override et
- Özel IPC kanalları: `getCustomHandlers()` ile ekle
- **Validasyon serviste yapılır** — repository'de yasak
- Hata: `AppError` kullan — `throw new Error()` yasak
- Log: `Logger` kullan — `console.log` yasak
- Yanıt: `ServiceResponse<T>` formatında dön

```typescript
// Zorunlu şablon
export class {Modul}Service extends BaseService<{Modul}> {
  protected getModuleName(): string {
    return '{Modul}Service'  // PascalCase sınıf adı (örn: 'FolderService')
  }
  protected getChannelPrefix(): string {
    return '{modul}'
  }
}
```

## 4. Güvenlik Kontrolleri

- Şifreler varsa `bcryptjs` ile hashle (SALT_ROUNDS = 8)
- Yanıtlarda şifre alanı döndürme — `stripPassword()` pattern'i
- Rol hiyerarşisi kontrolü: `system (4) > superadmin (3) > admin (2) > user (1)`
- `system` rolü arayüzden atanamaz, seed ile oluşturulur
- Sıralı numara üretimi atomik transaction içinde (`createWithAutoNumbers` pattern)
- Eşzamanlı güncelleme riski varsa optimistic locking değerlendirilir

## 5. ServiceManager'a Kaydet

- `src/main/index.ts` → `serviceManager.register(new {Modul}Service())` ekle

## 6. Dosya Başlık Bloğu (Zorunlu)

Her `.ts` dosyası aşağıdaki blokla başlar:

```typescript
// ============================================================
// DosyaAdı - Kısa açıklama (Türkçe)
//
// Sorumlulukları:
// 1. ...
// 2. ...
// ============================================================
```

## 7. Doğrulama

// turbo
7a. `npm run typecheck`

// turbo
7b. `npm run lint`
