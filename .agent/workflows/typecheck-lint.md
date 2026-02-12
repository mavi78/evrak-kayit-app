---
description: Kod doğrulama — TypeCheck ve Lint çalıştırma iş akışı
---

# TypeCheck ve Lint Doğrulama

Her kod değişikliğinden sonra aşağıdaki doğrulama adımları **mutlaka** uygulanır. Hata bulunursa düzeltilmeden işlem tamamlanmış sayılmaz.

## 1. TypeCheck

Proje iki ayrı `tsconfig` kullanır. Tek `npx tsc --noEmit` çalışmaz.

// turbo
1a. TypeCheck komutunu çalıştır:

```
npm run typecheck
```

- `tsconfig.node.json` → Main / Preload / Shared
- `tsconfig.web.json` → Renderer / Shared

Hata çıkarsa: ilgili dosyayı aç, hatayı düzelt ve tekrar çalıştır.

## 2. Lint

// turbo
2a. Lint komutunu çalıştır:

```
npm run lint
```

Hata çıkarsa: ilgili dosyayı aç, hatayı düzelt ve tekrar çalıştır.

## 3. Son Kontrol

Her iki adım da hatasız tamamlandıysa doğrulama başarılıdır.
