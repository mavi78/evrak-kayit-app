---
description: Kod kalite kontrolü — tüm kuralların uygulanıp uygulanmadığını doğrulama kontrol listesi
---

# Kod Kalite Kontrol Listesi

Kod yazdıktan sonra veya mevcut kodu incelerken aşağıdaki kontrol listesi uygulanır.

## 1. TypeScript Strict Kuralları

- [ ] `any` tipi kullanılmamış — `unknown` + type guard kullanılmış
- [ ] Tüm fonksiyonlarda açık dönüş tipi belirtilmiş
- [ ] Arrow, normal ve method tanımlarında dönüş tipi var
- [ ] `void` dönen fonksiyonlarda bile `: void` yazılmış
- [ ] Async fonksiyonlarda `Promise<T>` kullanılmış

## 2. İsimlendirme Kuralları

- [ ] Dosya/modül: camelCase veya kebab-case
- [ ] Klasörler: kebab-case
- [ ] Değişkenler: camelCase
- [ ] Sabitler: UPPER_SNAKE_CASE
- [ ] Fonksiyonlar: camelCase, fiil ile başlıyor
- [ ] Sınıflar: PascalCase
- [ ] Interface/Type: PascalCase, "I" prefix yok
- [ ] Enum: PascalCase, üyeleri UPPER_SNAKE

## 3. Backend Kuralları (src/main/)

- [ ] Repository `BaseRepository<T>`'den türetilmiş
- [ ] Service `BaseService<T>`'den türetilmiş
- [ ] Validasyon serviste yapılmış (repository'de değil)
- [ ] `AppError` kullanılmış (`throw new Error()` yok)
- [ ] `Logger` kullanılmış (`console.log/warn/error` yok)
- [ ] Hatalar yutulmamış (boş `catch` bloğu yok)
- [ ] SQL sorgularında parameterized query kullanılmış
- [ ] Dosya başlık bloğu var

## 4. Frontend Kuralları (src/renderer/)

- [ ] Sadece fonksiyonel bileşen (class component yok)
- [ ] Açık `React.JSX.Element` dönüş tipi
- [ ] UI bileşenleri sadece Mantine'den
- [ ] İkonlar sadece `@tabler/icons-react`'tan
- [ ] Ham HTML elementleri yok (button, input, select, table)
- [ ] Inline style yok
- [ ] DOM manipülasyonu yok (`document.getElementById` vb.)
- [ ] API çağrıları `lib/api.ts` üzerinden
- [ ] `response.success` kontrolü var
- [ ] `alert()` / `window.confirm()` yok — `@mantine/notifications` kullanılmış

## 5. IPC / Shared Kuralları

- [ ] Kanal adı `{modul}:{aksiyon}` formatında
- [ ] Tüm tipler `src/shared/types/` altında tanımlanmış
- [ ] Frontend/backend'de ayrı tip tanımı yok
- [ ] Yanıt `ServiceResponse<T>` formatında
- [ ] Preload'da 3 generic fonksiyon dışında expose yok

## 6. Genel

- [ ] JSDoc açıklamaları Türkçe
- [ ] DRY prensibi uygulanmış (tekrar eden kod yok)
- [ ] Single Responsibility uygulanmış
- [ ] Props drilling yok (3+ seviye)
- [ ] State içinde türetilebilir veri saklanmamış

## 7. Doğrulama

// turbo
7a. `npm run typecheck`

// turbo
7b. `npm run lint`
