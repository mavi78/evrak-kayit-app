---
description: Yeni modül ekleme iş akışı — shared types'tan UI'a kadar tüm katmanları kapsar
---

# Yeni Modül Ekleme

Yeni bir modül eklerken aşağıdaki adımlar **sırasıyla** takip edilir. Her adım tamamlanmadan bir sonrakine geçilmez.

## 1. Shared Types — Tip Tanımları

- `src/shared/types/{modul}.types.ts` dosyasını oluştur
- Modül entity'si `BaseEntity`'den türetilir
- Create/Update request interface'leri tanımlanır
- `src/shared/types/index.ts` barrel export'a eklenir

## 2. Shared Utils — Sabitler ve Doğrulama

- `src/shared/utils/constants.ts` → `PAGE_KEYS`'e sayfa anahtarı ekle
- `MENU_PAGE_KEYS` ve `PAGES_REQUIRING_PERMISSION` güncelle (gerekirse)
- `src/shared/utils/validation.ts` → Gerekli doğrulama fonksiyonları ekle

## 3. Backend — Repository

- `src/main/modules/{modul-adi}/` klasörünü oluştur
- `{modul-adi}.repository.ts` → `BaseRepository<T>` sınıfından türet
- `getTableName()`, `getTableSchemas()` zorunlu tanımlanır
- Boolean alanlar varsa `getBooleanColumns()` override edilir
- SQL sorgularında **parameterized query** (`?`) kullanılır

## 4. Backend — Service

- `{modul-adi}.service.ts` → `BaseService<T>` sınıfından türet
- `getModuleName()` ve `getChannelPrefix()` zorunlu tanımlanır
- Standart CRUD: `handleCreate`, `handleUpdate`, `handleDelete` override edilir
- Özel kanallar `getCustomHandlers()` ile eklenir
- Validasyon **serviste** yapılır, repository'de değil
- Hata yönetimi: `AppError` kullanılır, `throw new Error()` yasak
- Loglama: `Logger` kullanılır, `console.log` yasak

## 5. Backend — Kayıt

- `src/main/index.ts` → `serviceManager.register(new YourService())` ile kaydet

## 6. Frontend — API Katmanı

- `src/renderer/src/lib/api.ts` → Modül API fonksiyonlarını ekle
- Her fonksiyon `ServiceResponse<T>` tipinde döner
- `window.api.invoke('{modul}:{aksiyon}', data)` formatında IPC çağrısı

## 7. Frontend — Sayfa Bileşeni

- `src/renderer/src/pages/{modul-adi}/` klasörü oluştur
- `{ModulAdi}Page.tsx` dosyasını oluştur (fonksiyonel bileşen, açık dönüş tipi)
- UI bileşenleri **sadece Mantine** kütüphanesinden
- İkonlar **sadece `@tabler/icons-react`** kütüphanesinden
- API çağrıları `lib/api.ts` üzerinden (doğrudan `window.api.invoke()` yasak)

## 8. Frontend — Routing ve Menü

- `src/renderer/src/router/routes.ts` → Route tanımı ekle (`pageKey`, `minimumRole` tanımla)
- Sayfa `lazy()` ile yüklenir
- `src/renderer/src/components/layout/AppSidebar.tsx` → `PAGE_ICONS`'a ikon ekle

## 9. Doğrulama

// turbo
9a. `npm run typecheck` — Tip hatası kontrolü

// turbo
9b. `npm run lint` — Lint kontrolü

Hata bulunursa düzeltilmeden işlem tamamlanmış sayılmaz.
