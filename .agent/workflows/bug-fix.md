---
description: Hata düzeltme (bug fix) iş akışı — tespit, analiz ve çözüm
---

# Bug Fix İş Akışı

Bir hata bildirildiğinde veya tespit edildiğinde aşağıdaki adımlar takip edilir.

## 1. Hatayı Anla ve Yeniden Üret

- Hatanın tam açıklamasını al (hata mesajı, beklenen vs gerçek davranış)
- Hangi katmanda oluştuğunu belirle (frontend / backend / IPC / shared)
- Mümkünse hatayı yeniden üret

## 2. Kök Neden Analizi

- Hata mesajını ve stack trace'i incele
- İlgili dosyaları oku ve sorunlu kodu tespit et
- Bağımlı dosyaları kontrol et (tip uyumsuzluğu, eksik parametre vb.)

## 3. İlgili Skill'i Oku

- Hatanın oluştuğu katmanın skill'ini oku:
  - Backend → `backend-architecture`
  - Frontend → `frontend-architecture`
  - IPC/Shared → `shared-contracts`
- Doğru pattern'lerin uygulandığından emin ol

## 4. Düzeltmeyi Uygula

- Minimum değişiklikle hatayı düzelt (gereksiz refactoring yapma)
- `AppError` kullanımını doğrula (backend)
- `ServiceResponse.success` kontrolünü doğrula (frontend)
- Edge case'leri kontrol et

## 5. Yan Etki Kontrolü

- Düzeltmenin başka yerleri kırmadığından emin ol
- İlgili dosyalardaki benzer hataları kontrol et

## 6. Doğrulama (Zorunlu)

```
npm run typecheck
npm run lint
```

Her iki komut da hatasız geçmelidir. Hata varsa düzelt ve tekrar çalıştır.
