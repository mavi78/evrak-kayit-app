---
name: frontend-architecture
description: React Renderer frontend mimari rehberi. Sayfa oluşturma iş akışı, state yönetimi, API entegrasyonu, routing, yetkilendirme ve kod yapısı kalıpları. Frontend kodu yazarken, yeni sayfa eklerken veya mimari kararlar alırken kullanılır. UI/UX ve Mantine bileşen detayları için ui-ux-pro-max skill kullanılır.
---

# Frontend Architecture (React Renderer)

Electron Renderer süreci. React 19 + Mantine 8 + React Router 7 + TypeScript.

> **UI/UX ve bileşen detayları için** → [ui-ux-pro-max skill](../ui-ux-pro-max/SKILL.md) kullanın.
> Bu skill yalnızca **kod mimarisi, state yönetimi ve veri akışı** kalıplarını kapsar.

## Klasör Yapısı

```
src/renderer/src/
├── components/         # Tekrar kullanılabilir bileşenler
│   ├── layout/         #   AppHeader, AppLayout, AppSidebar
│   └── common/         #   Ortak bileşenler (ConfirmModal, DataTable, vb.)
├── context/            # Global state (Context + useReducer)
│   ├── index.ts        #   Barrel: AuthProvider, AuthContext, AuthContextValue (tek giriş)
│   ├── AuthContext.tsx #   AuthProvider bileşeni (Fast Refresh uyumu için sadece provider)
│   └── auth-context-def.ts # Context tanımı (createContext, reducer, tipler)
├── hooks/              # Custom hook'lar (useAuth, useDocument, vb.)
├── lib/                # API katmanı ve yardımcılar
│   ├── api.ts          #   Tüm IPC çağrıları (modül bazlı)
│   └── notifications.ts #  Bildirim yardımcıları
├── pages/              # Sayfa bileşenleri (lazy loaded)
│   └── {sayfa-adi}/    #   Her sayfa kendi klasöründe
├── router/             # Route tanımları ve guard'lar
└── theme/              # Mantine tema yapılandırması
```

- **Context kullanımı:** Tüm context import'ları `@renderer/context` üzerinden yapılır (barrel). `AuthProvider` ve `AuthContext`/`AuthContextValue` aynı barrel'den gelir; çözümleyici karışıklığını önlemek için context tanımı `auth-context-def.ts` dosyasındadır.

---

## Yeni Sayfa Ekleme İş Akışı

### Adım 1: Shared Types

Eğer yeni bir modülse, önce `src/shared/types/{modul}.types.ts` oluşturun. Detaylar için [shared-contracts skill](../shared-contracts/SKILL.md) kullanın.

### Adım 2: API Fonksiyonları Ekle

```typescript
// src/renderer/src/lib/api.ts
import type { ServiceResponse, YourEntity, CreateYourRequest } from '@shared/types'

export const yourModuleApi = {
  // Standart CRUD — kanal adları BaseService pattern ile eşleşir
  getAll: (): Promise<ServiceResponse<YourEntity[]>> =>
    invoke<YourEntity[]>('your-module:get-all'),

  getById: (id: number): Promise<ServiceResponse<YourEntity>> =>
    invoke<YourEntity>('your-module:get-by-id', { id }),

  create: (data: CreateYourRequest): Promise<ServiceResponse<YourEntity>> =>
    invoke<YourEntity>('your-module:create', data),

  update: (data: UpdateYourRequest): Promise<ServiceResponse<YourEntity>> =>
    invoke<YourEntity>('your-module:update', data),

  delete: (id: number): Promise<ServiceResponse<boolean>> =>
    invoke<boolean>('your-module:delete', { id }),

  // Özel endpointler
  search: (query: string): Promise<ServiceResponse<YourEntity[]>> =>
    invoke<YourEntity[]>('your-module:search', { query }),
}
```

### Adım 3: Sayfa Bileşeni Oluştur

```typescript
// src/renderer/src/pages/{sayfa-adi}/{SayfaAdi}Page.tsx
export default function YourPage(): React.JSX.Element {
  // 1. State tanımları
  const [items, setItems] = useState<YourEntity[]>([])
  const [loading, setLoading] = useState(true)

  // 2. Veri çekme fonksiyonu (useCallback ile memoize)
  const fetchItems = useCallback(async (): Promise<void> => {
    setLoading(true)
    const response = await yourModuleApi.getAll()
    if (response.success) {
      setItems(response.data)
    } else {
      showError(response.message)
    }
    setLoading(false)
  }, [])

  // 3. İlk yüklemede veri çek
  useEffect(() => { fetchItems() }, [fetchItems])

  // 4. Loading state kontrolü
  if (loading) return <LoadingSpinner />

  // 5. Sayfa render
  return (/* ... */)
}
```

**Sayfa bileşeni yapı sırası:** State → Veri çekme → useEffect → Handlers → Loading guard → Render

### Adım 4: Route Tanımı Ekle

```typescript
// src/renderer/src/router/routes.ts
const YourPage = lazy(() => import('@renderer/pages/{sayfa-adi}/{SayfaAdi}Page'))

// routes dizisine ekle:
{
  path: '/{sayfa-adi}',
  component: YourPage,
  pageKey: '{sayfa-adi}',         // PAGE_KEYS ile eşleşmeli
  showInSidebar: true,
  label: 'Sayfa Etiketi',
  minimumRole: 'user',            // Opsiyonel: minimum rol
  requiresPermission: true         // İzin kontrolü yapılsın mı
}
```

### Adım 5: Sidebar İkonu Ekle

```typescript
// src/renderer/src/components/layout/AppSidebar.tsx — PAGE_ICONS'a ekle
const PAGE_ICONS: Record<string, React.ReactNode> = {
  // ... mevcut ikonlar ...
  '{sayfa-adi}': <IconYourIcon size={20} stroke={1.5} />,
}
```

---

## State Yönetimi Kalıpları

| Kapsam | Yöntem | Ne Zaman? |
|--------|--------|-----------|
| Global (kullanıcı, tema) | Context + useReducer | Uygulama genelinde paylaşılan veri |
| Sayfa düzeyi (liste, filtre) | useState | Tek sayfaya özgü veri |
| Türetilebilir veri | useMemo | Hesaplanabilir, saklanmamalı |
| Form state | useForm (Mantine) | Form doğrulama ve yönetim |

### Global State — Context + useReducer Kalıbı

```typescript
// src/renderer/src/context/{Modul}Context.tsx
import { createContext, useReducer, useCallback, type ReactNode } from 'react'

// 1. State tipi
interface YourState {
  items: YourEntity[]
  isLoading: boolean
}

// 2. Action tipleri (discriminated union)
type YourAction =
  | { type: 'SET_ITEMS'; payload: YourEntity[] }
  | { type: 'SET_LOADING'; payload: boolean }

// 3. Reducer (saf fonksiyon)
function yourReducer(state: YourState, action: YourAction): YourState {
  switch (action.type) {
    case 'SET_ITEMS':
      return { ...state, items: action.payload }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    default:
      return state
  }
}

// 4. Context değer tipi (dışa aktarılır)
export interface YourContextValue {
  state: YourState
  fetchItems: () => Promise<void>
}

// 5. Context oluştur (null başlangıç)
export const YourContext = createContext<YourContextValue | null>(null)

// 6. Provider bileşeni
export function YourProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, dispatch] = useReducer(yourReducer, { items: [], isLoading: false })

  const fetchItems = useCallback(async (): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true })
    const response = await yourModuleApi.getAll()
    if (response.success) {
      dispatch({ type: 'SET_ITEMS', payload: response.data })
    }
    dispatch({ type: 'SET_LOADING', payload: false })
  }, [])

  return (
    <YourContext.Provider value={{ state, fetchItems }}>
      {children}
    </YourContext.Provider>
  )
}
```

### Custom Hook (Her context için zorunlu)

```typescript
// src/renderer/src/hooks/useYour.ts
import { useContext } from 'react'
import { YourContext, type YourContextValue } from '@renderer/context'  // ← Barrel import

export function useYour(): YourContextValue {
  const context = useContext(YourContext)
  if (!context) {
    throw new Error('useYour hook, YourProvider içinde kullanılmalıdır')
  }
  return context
}
```

> **Not:** Tüm context import'ları `@renderer/context` barrel'inden yapılır. Dosya adları arasında çözümleyici karışıklığını önlemek için context tanımı (createContext, reducer, tipler) `{modul}-context-def.ts`, provider bileşeni `{Modul}Context.tsx` dosyasında tutulur.

---

## API Katmanı Kuralları

### Yapı

```
Bileşen → lib/api.ts (tipli fonksiyon) → window.api.invoke (preload) → IPC → Backend
```

### Kurallar

- Tüm backend çağrıları **sadece** `lib/api.ts` üzerinden yapılır
- Her API fonksiyonu `ServiceResponse<T>` tipinde döner
- Her çağrıdan sonra `response.success` kontrolü **zorunlu**

```typescript
// ✅ DOĞRU — api.ts üzerinden, hata kontrolü var
const response = await yourModuleApi.getAll()
if (!response.success) {
  showError(response.message)
  return
}
const items = response.data

// ❌ YASAK — doğrudan IPC, hata kontrolü yok
const data = await window.api.invoke('your-module:get-all')
setItems(data.data)
```

### API Yanıtını İşleme (handleApiResponse)

```typescript
// Kısa yol: Hata → otomatik bildirim, başarı → opsiyonel bildirim
const response = await yourModuleApi.create(data)
handleApiResponse(response, { showSuccess: true, successMessage: 'Kayıt oluşturuldu' })
if (response.success) {
  // başarılı işlem sonrası aksiyon
  form.reset()
  onClose()
  fetchItems()  // listeyi yenile
}
```

---

## Form Yönetim Kalıbı

```typescript
// 1. Form tipi tanımla
interface FormValues {
  title: string
  category: string
}

// 2. useForm ile form oluştur
const form = useForm<FormValues>({
  initialValues: { title: '', category: '' },
  validate: {
    title: (v) => (v.trim().length === 0 ? 'Başlık zorunludur' : null),
    category: (v) => (!v ? 'Kategori seçiniz' : null),
  },
})

// 3. Submit handler — API çağrısı + bildirim + temizlik
const handleSubmit = async (values: FormValues): Promise<void> => {
  setLoading(true)
  const response = await yourModuleApi.create(values)
  handleApiResponse(response, { showSuccess: true, successMessage: 'Kayıt oluşturuldu' })
  if (response.success) {
    form.reset()
    onClose()
    onSuccess()  // üst bileşene bildir (liste yenileme vb.)
  }
  setLoading(false)
}

// 4. Form JSX'te: form.onSubmit(handleSubmit) ve form.getInputProps('fieldName')
```

---

## Router ve Yetkilendirme

### Route Yapılandırma Alanları

| Alan | Tip | Açıklama |
|------|-----|----------|
| `path` | `string` | URL yolu (`/incoming-documents`) |
| `component` | `LazyExoticComponent` | Lazy loaded sayfa bileşeni |
| `pageKey` | `PageKey` | İzin kontrolü anahtarı |
| `showInSidebar` | `boolean` | Menüde göster |
| `label` | `string` | Menü etiketi |
| `minimumRole` | `UserRole?` | Minimum rol seviyesi |
| `requiresPermission` | `boolean` | İzin tablosu kontrolü |

### ProtectedRoute Kontrol Sırası

1. `isAuthenticated` → Hayır → `/login`'e yönlendir
2. `minimumRole` kontrolü → Yetersiz → `/dashboard`'a yönlendir
3. `requiresPermission` + `hasPageAccess()` → Yetkisiz → `/dashboard`'a yönlendir
4. Tüm kontroller geçti → Sayfayı göster

---

## YASAK Kullanımlar

| Konu | YASAK | Kullan |
|------|-------|--------|
| HTML elementleri | `<button>`, `<input>`, `<table>` | Mantine bileşenleri |
| UI kütüphanesi | Bootstrap, MUI, Ant Design | Sadece Mantine |
| IPC çağrısı | `window.api.invoke(...)` direkt | `lib/api.ts` fonksiyonları |
| Diyaloglar | `alert()`, `window.confirm()` | Mantine Modal / Notifications |
| Bileşen türü | Class component | Fonksiyonel bileşen |
| DOM erişimi | `document.getElementById()` | React ref / Mantine hook |
| Global state | `useState` (3+ seviye prop) | Context + useReducer |
| API çağrısı | `useEffect` içinde direkt | Custom hook üzerinden |

---

## Detaylı Referanslar

- CRUD sayfa tam şablonu: [templates/data-display.md](templates/data-display.md)
- **UI/UX, Mantine bileşen kalıpları, stil ve tasarım:** [ui-ux-pro-max skill](../ui-ux-pro-max/SKILL.md) kullanın
