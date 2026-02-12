---

## description: TypeScript strict typing - any kullanımını yasaklar ve fonksiyon dönüş tiplerini zorunlu kılar

# TypeScript Strict Typing Kuralları

## 1. `any` Kullanımı Kesinlikle Yasak

`any` tipi hiçbir koşulda kullanılmamalıdır. Bunun yerine doğru tipi belirle veya `unknown` kullan.

```typescript
// YANLIS
function parse(data: any): any {
  return data.value
}

// DOGRU
function parse(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String((data as Record<string, unknown>).value)
  }
  throw new Error('Geçersiz veri formatı')
}
```

- `any` yerine `unknown` kullan, ardından type guard ile daralt.
- Üçüncü parti kütüphane tipleri eksikse, interface veya type alias tanımla.
- Generic tipler (`<T>`) kullanarak esnek ama güvenli yapılar oluştur.

## 2. Fonksiyon Dönüş Tipi Zorunlu

Tüm fonksiyonlarda dönüş tipi açıkça yazılmalıdır. TypeScript'in tip çıkarımına bırakma.

```typescript
// YANLIS
function topla(a: number, b: number) {
  return a + b
}

const kullaniciBul = async (id: string) => {
  return await db.kullanicilar.findOne({ id })
}

// DOGRU
function topla(a: number, b: number): number {
  return a + b
}

const kullaniciBul = async (id: string): Promise<Kullanici | null> => {
  return await db.kullanicilar.findOne({ id })
}
```

- Arrow function, normal function ve method tanımlarının hepsinde dönüş tipi yaz.
- `void` dönen fonksiyonlarda bile `: void` belirt.
- Async fonksiyonlarda `Promise<T>` kullan.
