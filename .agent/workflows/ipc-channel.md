---
description: Yeni IPC kanalı ekleme iş akışı — kanal tanımlama, tip güvenliği ve preload kuralları
---

# Yeni IPC Kanalı Ekleme

Yeni bir IPC kanalı eklerken aşağıdaki adımlar takip edilir.

## 1. Kanal Adlandırma Kuralı

Format: `{modul}:{aksiyon}`

```
✅ auth:login, document:create, document:search
❌ getUsers, createDoc, AUTH_LOGIN, auth/login
```

- Modül adı: kebab-case, tekil (`auth`, `document`, `report`)
- Aksiyon: kebab-case, fiil ile başlar (`get-all`, `create`, `update`, `delete`)
- Standart CRUD: `{modul}:get-all`, `{modul}:get-by-id`, `{modul}:create`, `{modul}:update`, `{modul}:delete`

## 2. Tip Tanımları

- `src/shared/types/{modul}.types.ts` → Request/Response tipleri tanımla
- `src/shared/types/index.ts` → Barrel export güncelle
- **Yasak**: Frontend veya backend'de ayrı ayrı aynı tipi tanımlamak
- **Yasak**: IPC üzerinden `any` tipinde veri göndermek

## 3. Kanal Türüne Göre Kayıt

### A) Modül Kanalı (Standart)

Modül servisi `getCustomHandlers()` ile eklenir:

```typescript
protected getCustomHandlers(): ServiceHandlerMap {
  return {
    '{modul}:{aksiyon}': (data) => this.handleCustomAction(data)
  }
}
```

### B) Sistem Kanalı (`app:` namespace)

`src/main/index.ts` içinde doğrudan `ipcMain.handle()` ile:

```typescript
ipcMain.handle('app:{aksiyon}', async () => { ... })
```

- Sistem kanallarında iş mantığı yasak
- `src/shared/types/app.types.ts` güncellenir

## 4. Yanıt Formatı

Tüm IPC yanıtları `ServiceResponse<T>` formatında:

```typescript
interface ServiceResponse<T = null> {
  success: boolean
  data: T
  message: string
  statusCode: number
}
```

- Ham veri (string, number, array) döndürmek **yasak**
- Başarılı: `{ success: true, data: T, message, statusCode: 200|201 }`
- Hata: `{ success: false, data: null, message, statusCode: 4xx|5xx }`

## 5. Frontend API Entegrasyonu

- `src/renderer/src/lib/api.ts` → API fonksiyonu ekle
- `window.api.invoke('{modul}:{aksiyon}', data)` çağrısı
- Bileşen içinde doğrudan `window.api.invoke()` **yasak**
- Her çağrıdan sonra `response.success` kontrolü zorunlu

## 6. Preload Kuralları (Hatırlatma)

Preload **yalnızca** 3 generic fonksiyon expose eder:

- `invoke(channel, data?)` — Request-response
- `on(channel, callback)` — Olay dinleme
- `off(channel, callback)` — Olay dinlemeyi kaldırma

Yeni fonksiyon expose etmek, Node.js API vermek **yasak**.

## 7. Doğrulama

// turbo
7a. `npm run typecheck`

// turbo
7b. `npm run lint`
