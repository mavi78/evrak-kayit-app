---
description: Kod yeniden yapılandırma (refactoring) iş akışı — mevcut kodu iyileştirme
---

# Refactoring İş Akışı

Mevcut kodu yeniden yapılandırırken aşağıdaki adımlar takip edilir.

## 1. Etki Analizi

- Değişikliğin hangi katmanları etkilediğini belirle (shared / backend / frontend / UI)
- Etkilenen dosyaları listele
- Bağımlılık zincirini kontrol et

## 2. İlgili Skill'leri Oku

- Etkilenen her katmanın skill'ini bağımlılık sırasıyla oku:
  - `shared-contracts` → `backend-architecture` → `frontend-architecture` → `ui-ux-pro-max`
- Yalnızca etkilenen katmanların skill'leri okunur

## 3. Refactoring Uygula

- Değişiklikleri **küçük, bağımsız commit'ler** halinde yap
- Her değişiklikten sonra mevcut testlerin çalıştığını doğrula
- SOLID prensiplerini (özellikle SRP ve DRY) uygula
- İsimlendirme standartlarına uy (camelCase, PascalCase)

## 4. Geriye Dönük Uyumluluk

- Mevcut API kontratlarını (IPC kanalları, `ServiceResponse` formatı) korumaya dikkat et
- Public interface değişiyorsa tüm kullanım noktalarını güncelle
- `shared/types` değişiyorsa hem backend hem frontend'i kontrol et

## 5. Doğrulama (Zorunlu)

```
npm run typecheck
npm run lint
```

Her iki komut da hatasız geçmelidir. Hata varsa düzelt ve tekrar çalıştır.
