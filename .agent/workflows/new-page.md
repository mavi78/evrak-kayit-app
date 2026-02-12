---
description: Yeni sayfa ekleme iş akışı — mevcut modüle sayfa bileşeni, route ve menü ekleme
---

# Yeni Sayfa Ekleme

Mevcut bir modüle yeni sayfa eklerken aşağıdaki adımlar takip edilir.

## 1. Sayfa Bileşenini Oluştur

- `src/renderer/src/pages/{sayfa-adi}/` klasörünü oluştur
- `{SayfaAdi}Page.tsx` dosyası oluştur
- **Sadece fonksiyonel bileşen** — class component yasak
- Açık `React.JSX.Element` dönüş tipi belirt
- Props interface'i bileşen dosyasının üstünde tanımla

```typescript
// Örnek yapı
interface SayfaAdiPageProps {
  // ...
}

export default function SayfaAdiPage({ ... }: SayfaAdiPageProps): React.JSX.Element {
  return (...)
}
```

## 2. UI Standartlarına Uy

- UI bileşenleri **sadece Mantine** kütüphanesinden (`Button`, `TextInput`, `Table`, vb.)
- İkonlar **sadece `@tabler/icons-react`** kütüphanesinden
- Ham HTML elementleri (button, input, select, table) **yasak**
- Inline style **yasak** — Mantine `style` prop veya CSS modülleri kullan
- Bildirimler `@mantine/notifications` ile — `alert()` / `window.confirm()` yasak
- Formlar `@mantine/form` ile yönetilir

## 3. API Çağrıları

- `src/renderer/src/lib/api.ts` üzerinden yapılır (doğrudan `window.api.invoke()` yasak)
- Her API çağrısından sonra `response.success` kontrolü **zorunlu**
- API fonksiyonları yoksa `api.ts`'e ekle

## 4. State Yönetimi

| Kapsam                   | Yöntem                    |
| ------------------------ | ------------------------- |
| Global (kullanıcı, tema) | Context + useReducer      |
| Sayfa düzeyi             | useState / useReducer     |
| Server state             | API çağrısı + local state |

- Props drilling (3+ seviye) yasak — Context veya composition pattern kullan
- State içinde türetilebilir veri saklama — `useMemo` kullan

## 5. Route Ekle

- `src/renderer/src/router/routes.ts` → Route tanımı ekle
- `pageKey` ve `minimumRole` tanımla
- Sayfa `lazy()` ile yüklenir: `const Page = lazy(() => import(...))`
- Korunan sayfa ise `ProtectedRoute` ile sarmala

## 6. Menü / Sidebar

- `src/renderer/src/components/layout/AppSidebar.tsx` → `PAGE_ICONS`'a ikon ekle
- Gerekirse `src/shared/utils/constants.ts` → `PAGE_KEYS`, `MENU_PAGE_KEYS` güncelle

## 7. Doğrulama

// turbo
7a. `npm run typecheck`

// turbo
7b. `npm run lint`

Hata bulunursa düzeltilmeden işlem tamamlanmış sayılmaz.
