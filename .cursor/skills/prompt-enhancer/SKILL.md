---
name: prompt-enhancer
description: Her kodlama isteğinde otomatik uygulanan ön akış. İsteği soru-cevap ile netleştirir, projeyi analiz eder, detaylı uygulama planı oluşturur ve kodlamaya başlamak için onay ister. Kullanıcının "prompt geliştir" demesine gerek yoktur.
---

# Prompt Enhancer — Kodlama İstekleri Ön Akışı

Her kodlama isteğinde **otomatik olarak** uygulanan ön akış skill'i. Kullanıcının "prompt geliştir" demesine gerek yoktur; bir kodlama isteği algılandığında bu akış kendiliğinden başlar.

**Amaç:** İsteği tam olarak anlamak, belirsizlikleri gidermek, projeyi analiz edip detaylı bir uygulama planı oluşturmak ve kullanıcı onayı aldıktan sonra kodlamaya geçmek.

---

## Tetikleme Koşulları

| Durum | Bu skill uygulanır mı? |
|-------|------------------------|
| Kodlama isteği (yeni özellik, refactoring, bug fix, UI değişikliği vb.) | **Evet** — tam akış uygulanır |
| Genel soru (teorik bilgi, açıklama isteme, "X nedir?" türü) | **Hayır** — skill atlanır, doğrudan yanıt verilir |
| Git / commit / push isteği | **Hayır** — `github-turkish-commit` skill'i uygulanır |
| Skill / kural dosyası düzenleme isteği | **Hayır** — doğrudan düzenleme yapılır |

---

## İş Akışı

### Adım 1: İsteği Al ve Sınıflandır

- Kullanıcının mesajını oku.
- Kodlama isteği mi, genel soru mu belirle.
- **Kodlama isteği** → Adım 2'ye geç.
- **Genel soru / kodlama dışı** → Bu skill atlanır, ilgili akışa yönlendirilir.

### Adım 2: Netleştirme (Soru-Cevap / Öneri)

> **Bu adım kodlamadan ÖNCE uygulanır. İstek tamamen netleşene kadar bu adımda kalınır.**

İsteği analiz et ve aşağıdaki kontrolleri yap:

1. **Belirsiz noktaları tespit et:**
   - İstek yeterince detaylı mı?
   - Birden fazla yaklaşım/yol var mı?
   - Eksik bilgi var mı (hangi sayfa, hangi bileşen, hangi davranış)?

2. **Sorular veya öneriler sun:**
   - Belirsizlik varsa → **AskQuestion** ile kullanıcıya seçenekler sun.
   - Alternatif yaklaşımlar varsa → Avantaj/dezavantajlarıyla birlikte öner.
   - İstek zaten net ve tek yolu varsa → Bu adım kısa tutulup Adım 3'e geçilebilir.

3. **Netleşme kriteri:**
   - Tüm belirsizlikler giderildi mi?
   - Kullanıcının tercihleri belli mi?
   - Kapsam ve sınırlar net mi?
   - **Evet** → Adım 3'e geç.
   - **Hayır** → Ek sorular sorarak netleştirmeye devam et.

**Örnek AskQuestion kullanımı:**

```
Soru: "Form validasyonu için hangi yaklaşımı tercih edersiniz?"
Seçenekler:
  A) React Hook Form + Zod
  B) Mantine useForm + kendi validasyonları
  C) Custom hook ile manuel validasyon
```

**Kural:** Belirsizlik tamamen giderilmeden Adım 3'e geçilmez.

### Adım 3: Proje Analizi

> Netleşen isteğe göre proje bağlamını analiz et.

1. **Mevcut kod tabanını incele:**
   - İstekle ilgili mevcut dosyaları, modülleri ve bileşenleri bul ve oku.
   - Hangi katmanlar etkilenecek? (frontend, backend, shared, IPC)
   - Mevcut kalıplar ve konvansiyonlar neler?

2. **Teknoloji ve mimari bağlamı:**
   - Projede kullanılan stack: Electron + React + Mantine + TypeScript + better-sqlite3
   - Mimari: Repository → Service → IPC → Frontend (katmanlı)
   - Mevcut benzer implementasyonları referans al.

3. **Bağımlılıkları belirle:**
   - Bu değişiklik başka modülleri etkiler mi?
   - Önce hangi katman değiştirilmeli? (genelde: shared → backend → frontend)
   - Mevcut tip tanımları yeterli mi, yoksa yenileri gerekli mi?

**Kural:** Proje bağlamını tahmin etme; dosya okuyarak somut bilgi topla.

### Adım 4: Uygulama Planı Oluştur (Prompt Genişletme)

Netleşen istek + proje analizi sonuçlarını birleştirerek **detaylı uygulama planı** oluştur:

1. **Yapılacak işlerin özeti:**
   - Hangi dosyalar oluşturulacak / değiştirilecek
   - Hangi katmanlar etkilenecek
   - Tahmini adım sayısı

2. **Adım adım plan:**
   - Her adımda ne yapılacağı açıkça belirtilecek
   - Katmanlar arası bağımlılık sırası korunacak
   - Her adımda hangi skill kullanılacağı belirtilecek

3. **Kısıtlamalar ve dikkat edilecekler:**
   - Proje kurallarına uyum (isimlendirme, mimari, tip güvenliği)
   - Mevcut kodla tutarlılık
   - Performans ve güvenlik hususları

**Çıktı formatı:**

```
## Uygulama Planı

### Özet
[1-2 cümle ile ne yapılacağı]

### Etkilenen Katmanlar
- [ ] Shared (tipler, sabitler)
- [ ] Backend (repository, service, IPC handler)
- [ ] Frontend (sayfa, hook, bileşen)

### Adımlar
1. [Adım açıklaması] — Kullanılacak skill: [skill adı]
2. [Adım açıklaması] — Kullanılacak skill: [skill adı]
...

### Dikkat Edilecekler
- [Kısıtlama veya önemli not]
```

### Adım 5: Onay İste

Uygulama planını sunduktan sonra **AskQuestion** ile kodlamaya geçiş onayı al:

```
Soru: "Yukarıdaki plana göre implementasyona geçmemi ister misiniz?"
Seçenekler:
  A) Evet, implementasyona başla
  B) Hayır, planı düzenlemek istiyorum
  C) İptal — şimdilik kodlama istemiyorum
```

- Kullanıcı **"Evet"** derse → Adım 6'ya geç.
- Kullanıcı **"Hayır, düzenlemek istiyorum"** derse → Kullanıcının geri bildirimine göre planı revize et, tekrar onay iste.
- Kullanıcı **"İptal"** derse → İş akışı burada sonlanır.

**Kural:** Kullanıcı açıkça onay vermeden implementasyona başlanmaz.

### Adım 6: İmplementasyona Geç (Skill-Driven)

> Bu adım **yalnızca** Adım 5'te onay alındıysa uygulanır.

Onay alındıktan sonra, uygulama planını adım adım hayata geçir:

1. **Etkilenen katmanları belirle** ve her katman için ilgili skill'i oku:

   | Katman | Okunacak Skill |
   |--------|----------------|
   | Backend (Main process, servis, DB) | `.cursor/skills/backend-architecture/SKILL.md` |
   | Frontend (React, sayfa, hook) | `.cursor/skills/frontend-architecture/SKILL.md` |
   | UI/UX (bileşen, tasarım, stil) | `.cursor/skills/ui-ux-pro-max/SKILL.md` |
   | IPC / Shared (tip, kanal, preload) | `.cursor/skills/shared-contracts/SKILL.md` |

2. **TodoWrite ile iş planı oluştur:**
   - Uygulama planındaki adımları somut görevlere (todo) böl.
   - Her görev tek bir sorumluluk taşıyacak şekilde granüler olsun.
   - Katmanlar arası bağımlılıklara dikkat et (ör. önce shared tipler, sonra backend, sonra frontend).

3. **Adım adım implementasyona başla:**
   - Her todo'yu sırayla `in_progress` yap, ilgili skill'in akışına göre kodla.
   - Her adımda ilgili skill'deki kural ve kalıplara uy.
   - Her adım tamamlandığında todo'yu `completed` olarak işaretle.

4. **Doğrulama (her adım sonrası):**
   - `npm run typecheck` → Tip hatalarını kontrol et.
   - `npm run lint` → Lint hatalarını kontrol et.
   - Hata varsa düzelt, yoksa sonraki adıma geç.

5. **Tamamlandığında** kullanıcıya özet sun:
   - Hangi dosyalar oluşturuldu/değiştirildi
   - Hangi skill'ler kullanıldı
   - TypeCheck ve Lint sonuçları

**Kural:** Her adımda ilgili skill'in iş akışı harfiyen uygulanır. Skill okumadan kod yazılmaz.

---

## Dil Kuralı

- Kullanıcı ile **her zaman Türkçe** konuşulacak.
- Sorular, öneriler, plan ve açıklamalar Türkçe yazılacak.
- Kod içi isimler İngilizce kalacak.

---

## Kalite Kontrol Listesi

Her adım geçişinde şunları doğrula:

- [ ] İstek tam olarak anlaşıldı mı? (Adım 2)
- [ ] Tüm belirsizlikler giderildi mi? (Adım 2)
- [ ] Proje bağlamı somut verilerle analiz edildi mi? (Adım 3)
- [ ] Uygulama planı açık ve adım adım mı? (Adım 4)
- [ ] Kullanıcıdan onay alındı mı? (Adım 5)
- [ ] İlgili skill'ler okundu mu? (Adım 6)
- [ ] TypeCheck ve Lint başarılı mı? (Adım 6)
