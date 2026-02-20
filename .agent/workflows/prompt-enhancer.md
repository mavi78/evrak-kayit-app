---
description: Kodlama isteği ön akışı — netleştirme, analiz, plan ve onay adımları
---

# Prompt Enhancer — Kodlama İstekleri Ön Akışı

Kodlama isteği geldiğinde (`/prompt-enhancer`) bu akış uygulanır.

**Uygulanmaz:** Genel sorular, git/commit işlemleri, skill/kural düzenleme istekleri.

---

## 1. Netleştirme

- İsteği analiz et: belirsiz noktalar, eksik bilgiler, alternatif yaklaşımlar var mı?
- Belirsizlik varsa → `notify_user` ile sorular/seçenekler sun, cevap bekle.
- İstek zaten net ve tek yolu varsa → doğrudan Adım 2'ye geç.
- **Tüm belirsizlikler giderilmeden ilerlenme.**

## 2. Proje Analizi

- İstekle ilgili mevcut dosyaları, modülleri ve bileşenleri bul ve oku.
- Hangi katmanlar etkilenecek? (shared, backend, frontend, IPC)
- Mevcut kalıp ve konvansiyonları tespit et.
- **Tahmin etme; dosya okuyarak somut bilgi topla.**

## 3. Uygulama Planı

- `implementation_plan.md` artifact'ini oluştur (Antigravity standart formatında).
- İçeriğe dahil edilecekler:
  - Özet (1-2 cümle)
  - Etkilenen katmanlar ve dosyalar ([NEW], [MODIFY], [DELETE] etiketleriyle)
  - Adım adım plan (katman bağımlılık sırasına göre: shared → backend → frontend)
  - Dikkat edilecekler (kısıtlamalar, proje kuralları)
  - Doğrulama planı

## 4. Onay

- `notify_user` ile planı kullanıcıya sun ve onay bekle.
- Onay gelirse → Adım 5'e geç.
- Değişiklik istenirse → planı revize et, tekrar onay iste.

## 5. İmplementasyon

- `task.md` ile iş planını checklist olarak oluştur.
- Her adımda ilgili skill'i oku (`backend-architecture`, `frontend-architecture`, `shared-contracts`).
- Katman bağımlılık sırasını koru: shared → backend → frontend.

// turbo
5a. `npm run typecheck` — Tip hatası kontrolü

// turbo
5b. `npm run lint` — Lint kontrolü

Hata varsa düzelt ve tekrar çalıştır. Hatasız geçene kadar tamamlanmış sayılmaz.

---

## Dil Kuralı

- Kullanıcı ile **Türkçe** konuşulur. Kod içi isimler İngilizce kalır.
