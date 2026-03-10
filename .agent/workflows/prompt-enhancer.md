---
description: Kodlama isteği ön akışı — netleştirme, analiz, plan ve onay adımları
---

# Prompt Enhancer — Kodlama İstekleri Ön Akışı

Kodlama isteği geldiğinde (`/prompt-enhancer`) bu akış uygulanır.

**Kapsam dışı:** Genel sorular, git/commit, skill/kural düzenleme, tek satırlık düzeltmeler.

---

## Adım 1 · Netleştirme (Gerekirse)

İsteği analiz et:

1. Belirsiz nokta veya eksik bilgi var mı?
2. Birden fazla geçerli yaklaşım mevcut mu?

- **Belirsizlik varsa** → `notify_user` ile kısa ve numaralı sorular sor. Tüm yanıtlar gelene kadar ilerleme.
- **Net ise** → Adım 2'ye geç.

> Amaç: Gereksiz soru sorma. Sadece implementasyonu etkileyecek belirsizlikleri sor.

---

## Adım 2 · Kod Tabanı Analizi

Minimum okuma, maksimum bilgi ilkesiyle çalış:

1. **Etki alanını belirle** — Hangi katmanlar etkilenecek? (shared / backend / frontend / IPC)
2. **Mevcut dosyaları oku** — Sadece değişecek veya referans alınacak dosyaları oku.
3. **Pattern tespiti** — Proje genelindeki naming, yapı ve konvansiyon kalıplarını not et.
4. **İlgili skill(ler)i oku** — Etkilenen katmanın skill dosyasını oku:
   - Backend → `backend-architecture`
   - Frontend → `frontend-architecture`
   - IPC / Shared → `shared-contracts`

> **Kural:** Tahmin etme, dosya okuyarak somut bilgi topla. Gereksiz dosya okumaktan kaçın.

---

## Adım 3 · Implementation Plan

`implementation_plan.md` artifact'ini oluştur. Aşağıdaki yapıyı kullan:

### Plan Yapısı

```markdown
# [Kısa Hedef Başlığı]

Bağlam ve değişikliğin ne sağlayacağı (maks. 2 cümle).

## Kullanıcı Onayı Gereken Noktalar (varsa)

> [!WARNING]
> Breaking change veya kritik karar açıklaması

## Değişiklikler

### [Katman/Bileşen Adı]

#### [MODIFY|NEW|DELETE] `dosya-adı.ts`

- Yapılacak değişikliğin kısa açıklaması
- Detay maddeleri (ne eklenecek/değişecek/silinecek)

---

### [Sonraki Katman/Bileşen]

...

## Doğrulama

- [ ] `npm run typecheck` hatasız
- [ ] `npm run lint` hatasız
- [ ] [Varsa fonksiyonel doğrulama adımları]
```

### Plan Yazım Kuralları

| Kural           | Açıklama                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------- |
| **Sıralama**    | Katman bağımlılık sırasını takip et: `shared → backend → frontend`                            |
| **Dosya bazlı** | Her dosya ayrı bir alt başlık. Etiket: `[NEW]`, `[MODIFY]`, `[DELETE]`                        |
| **Kısa yaz**    | Açıklama satırları kısa bullet point'ler olmalı, paragraf yazma                               |
| **Somut ol**    | "Gerekli değişiklikler yapılacak" gibi muğlak ifadeler kullanma; neyin nasıl değişeceğini yaz |
| **Kod snippet** | Plan içinde kod snippet'i kullanma, sadece yapılacak işi tarif et                             |
| **Scope aşma**  | İstekle ilgisiz iyileştirme/refactoring ekleme                                                |

---

## Adım 4 · Onay

- `notify_user` ile planı sun → `BlockedOnUser: true`, `ShouldAutoProceed: true`
- ✅ Onay → Adım 5
- 🔄 Revizyon → Planı güncelle, tekrar onay iste

---

## Adım 5 · İmplementasyon

1. `task.md` checklist'i oluştur (plan maddelerini `[ ]` formatına çevir).
2. Katman bağımlılık sırasıyla ilerle: `shared → backend → frontend`.
3. Her dosya değişikliğinde ilgili skill'e uy.

// turbo
5a. `npm run typecheck`

// turbo
5b. `npm run lint`

Hata varsa düzelt ve tekrar çalıştır. Her ikisi de hatasız geçmeden tamamlanmış sayılmaz.

---

## Dil Kuralı

- Kullanıcıyla **Türkçe** konuş. Kod içi isimler **İngilizce** kalır.
