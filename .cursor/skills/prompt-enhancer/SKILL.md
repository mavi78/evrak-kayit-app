---
name: prompt-enhancer
description: Kullanıcının ham veya kısa prompt'larını analiz edip daha net, kapsamlı ve etkili hale getirir. Kullanıcı "prompt'u geliştir", "prompt'u iyileştir", "daha iyi prompt yaz", "enhance prompt" veya benzeri ifadeler kullandığında tetiklenir.
---

# Prompt Enhancer

Kullanıcının verdiği ham prompt'u alıp analiz eden, eksikleri tespit eden ve profesyonel düzeyde geliştirilmiş bir prompt çıktısı üreten skill.

---

## İş Akışı

### Adım 1: Prompt'u Al ve Sınıflandır

- Kullanıcıdan ham veya kısa prompt'u girdi olarak al.
- Prompt metin olarak doğrudan mesajda verilebilir ya da bağlamdan çıkarılabilir.
- Eğer prompt belirsizse, kullanıcıya sor:
  - "Hangi prompt'u geliştirmemi istiyorsun?"
- Prompt'u hemen sınıflandır:
  - **Kodlama / Proje prompt'u** → Adım 1.5'e geç
  - **Genel prompt** (e-posta, makale, analiz vb.) → Doğrudan Adım 2'ye geç

### Adım 1.5: Proje Bağlamı Analizi (Sadece Kodlama Prompt'ları)

> Bu adım **yalnızca** prompt kodlama, yazılım veya mevcut projeyle ilgiliyse uygulanır.
> Genel amaçlı prompt'larda bu adım **atlanır**.

Prompt'u genişletmeden önce proje bağlamını anla:

1. **Teknoloji stack'i:** Projede hangi dil, framework ve kütüphaneler kullanılıyor?
   - `package.json`, `tsconfig.json`, proje yapısını tara
2. **Mimari kalıplar:** Proje hangi mimari desenleri kullanıyor?
   - Katmanlı mimari, modüler yapı, klasör konvansiyonları
3. **Proje kuralları:** Varsa `.cursor/rules/`, `AGENTS.md`, lint/format kurallarını oku
4. **Mevcut kod:** Prompt'un ilgili olduğu modül veya dosyaları incele

**Bu bilgiler prompt'a otomatik enjekte edilir:**
- Stack bilgisi → Kısıtlamalara eklenir (ör. "React + Mantine + TypeScript kullan")
- Mimari kalıplar → Yapısal talimatlara eklenir (ör. "Repository-Service katmanlı mimari uygula")
- Proje kuralları → Kısıtlamalara eklenir (ör. "JSDoc Türkçe yaz, camelCase kullan")

**Kural:** Proje bağlamını tahmin etme; dosya okuyarak somut bilgi topla.

### Adım 2: Niyeti Analiz Et

Prompt'un amacını, kapsamını ve bağlamını tespit et:

| Analiz Kriteri | Ne Yapılacak |
|----------------|--------------|
| **Hedef** | Prompt'un ulaşmak istediği sonucu belirle |
| **Kapsam** | Dar mı, geniş mi? Sınırları var mı? |
| **Bağlam** | Kime yönelik? Hangi alanda? Teknik mi, genel mi? |
| **Eksikler** | Belirsiz noktaları, atlanan detayları tespit et |
| **Kısıtlar** | Format, uzunluk, stil gibi belirtilmemiş kısıtlamaları belirle |

### Adım 3: Prompt'u Geliştir

Aşağıdaki teknikleri uygulayarak prompt'u yeniden yaz:

#### 3.1 Netlik (Clarity)
- Belirsiz ifadeleri somut ve ölçülebilir hale getir.
- "İyi bir yazı yaz" → "SEO uyumlu, 800 kelimelik, bilgilendirici bir blog yazısı yaz"

#### 3.2 Bağlam Ekleme (Context)
- Hedef kitle, alan, amaç gibi eksik bağlam bilgilerini ekle.
- Rol tanımı ekle (ör. "Sen deneyimli bir yazılım mimarısın...")

#### 3.3 Yapı ve Format (Structure)
- İsteniyorsa çıktı formatı belirle (liste, tablo, kod bloğu vb.)
- Adım adım talimatlar ekle.
- Bölümlere ayır (giriş, gelişme, sonuç vb.)

#### 3.4 Kısıtlamalar (Constraints)
- Uzunluk sınırı, dil, ton, stil gibi kısıtlamalar ekle.
- Yapılmaması gerekenleri belirt (negatif talimat).

#### 3.5 Örnekler (Few-shot)
- Gerekirse örnek girdi/çıktı çiftleri öner.
- "Aşağıdaki formatta yanıt ver: ..." gibi şablon sun.

### Adım 4: Çıktıyı Sun

Geliştirilmiş prompt'u aşağıdaki formatta sun:

```
## Geliştirilmiş Prompt

[Geliştirilmiş prompt metni burada]

---

## Yapılan İyileştirmeler

| # | İyileştirme | Açıklama |
|---|-------------|----------|
| 1 | ... | ... |
| 2 | ... | ... |
| 3 | ... | ... |

## Öneriler (Opsiyonel)

- [Prompt'u daha da güçlendirmek için ek öneriler]
```

### Adım 5: Belirsizlikleri Gider ve Seçenekleri Onayla

> Bu adım Adım 4'ten hemen sonra uygulanır.

Geliştirilmiş prompt'ta **öneriler**, **belirsiz noktalar** veya **birden fazla yaklaşım** varsa:

1. **AskQuestion** aracıyla kullanıcıya seçenekleri sun.
   - Her bir öneri veya belirsizlik ayrı bir soru olarak sunulur.
   - Seçenekler net ve anlaşılır olmalıdır.
2. Kullanıcının yanıtlarına göre prompt'u **güncelle** ve nihai haline getir.
3. Eğer öneriler veya belirsizlik yoksa bu adım atlanarak doğrudan Adım 6'ya geçilir.

**Örnek AskQuestion kullanımı:**

```
Soru: "Form validasyonu için hangi yaklaşımı tercih edersiniz?"
Seçenekler:
  A) React Hook Form + Zod
  B) Mantine useForm + kendi validasyonları
  C) Custom hook ile manuel validasyon
```

**Kural:** Belirsizlik tamamen giderilmeden ve kullanıcının tüm seçimleri netleşmeden Adım 6'ya geçilmez.

### Adım 6: İmplementasyon Onayı Al

Belirsizlikler giderildikten sonra (veya belirsizlik yoksa Adım 4'ten sonra):

1. Geliştirilmiş prompt'a dayalı olarak yapılacak işin **kısa özetini** sun:
   - Hangi dosyalar oluşturulacak/değiştirilecek
   - Hangi katmanlar etkilenecek (frontend, backend, shared, IPC)
   - Tahmini adım sayısı
2. **AskQuestion** ile implementasyona geçiş onayı al:

```
Soru: "Yukarıdaki plana göre implementasyona geçmemi ister misiniz?"
Seçenekler:
  A) Evet, implementasyona başla
  B) Hayır, prompt'u düzenlemek istiyorum
  C) Sadece prompt'u ver, implementasyon istemiyorum
```

3. Kullanıcı **"Evet"** derse → Adım 7'ye geç.
4. Kullanıcı **"Hayır, düzenlemek istiyorum"** derse → Adım 3'e dön, prompt'u revize et.
5. Kullanıcı **"Sadece prompt"** derse → İş akışı burada sonlanır, prompt teslim edilir.

**Kural:** Kullanıcı açıkça onay vermeden implementasyona başlanmaz.

### Adım 7: İmplementasyona Geç (Skill-Driven)

> Bu adım **yalnızca** Adım 6'da onay alındıysa uygulanır.

Onay alındıktan sonra, geliştirilmiş prompt'u **uygulama planına** dönüştür ve ilgili proje skill'lerini kullanarak adım adım implementasyona başla:

1. **Etkilenen katmanları belirle** ve her katman için ilgili skill'i oku:

   | Katman | Okunacak Skill |
   |--------|----------------|
   | Backend (Main process, servis, DB) | `.cursor/skills/backend-architecture/SKILL.md` |
   | Frontend (React, sayfa, hook) | `.cursor/skills/frontend-architecture/SKILL.md` |
   | UI/UX (bileşen, tasarım, stil) | `.cursor/skills/ui-ux-pro-max/SKILL.md` |
   | IPC / Shared (tip, kanal, preload) | `.cursor/skills/shared-contracts/SKILL.md` |

2. **TodoWrite ile iş planı oluştur:**
   - Geliştirilmiş prompt'taki gereksinimleri somut görevlere (todo) böl.
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

## Geliştirme Teknikleri Referansı

> **Temel Kural:** Aşağıdaki tekniklerin hiçbiri sabit şablon değildir.
> Her teknik, kullanıcının verdiği prompt'un **konusu, amacı ve karmaşıklığı** analiz edilerek
> **dinamik olarak** uygulanır. Sadece prompt'a değer katacak teknikler seçilir; hepsi zorunlu değildir.

### 1. Rol Tanımı (Role Prompting)

**Ne yapar:** Prompt'un başına, konuya uygun bir uzman kimliği ekler. Daha odaklı ve kaliteli çıktı sağlar.

**Nasıl uygulanır:**
- Adım 2'deki analiz sonucuna göre prompt'un alanını belirle (yazılım, tasarım, eğitim, pazarlama vb.)
- O alana uygun bir uzman rolü **otomatik türet** ve prompt'un başına ekle.
- Deneyim seviyesi, uzmanlık alanı ve perspektif gibi detaylar bağlama göre ayarlanır.

**Karar tablosu:**

| Prompt konusu | Türetilecek rol örneği |
|---------------|----------------------|
| Kod yazma, mimari | "Sen [X] yıl deneyimli bir [Y teknolojisi] geliştiricisisin..." |
| UI/UX tasarım | "Sen kullanıcı deneyimi odaklı bir ürün tasarımcısısın..." |
| İçerik üretme | "Sen [hedef kitleye] yönelik içerik üreten bir editörsün..." |
| Veri analizi | "Sen [sektör] alanında çalışan bir veri analistisin..." |
| Genel/belirsiz | Rol ekleme — sadece bağlam ve netlik güçlendir |

**Kural:** Rolü asla ezberden seçme; her zaman prompt'un amacından türet.

### 2. Zincir Düşünce (Chain of Thought)

**Ne yapar:** Karmaşık veya çok adımlı görevlerde, AI'ın adım adım düşünmesini sağlar. Daha doğru ve tutarlı sonuçlar üretir.

**Ne zaman uygulanır (dinamik karar):**
- Prompt tek adımda çözülebilecek basit bir istekse → **ekleme**
- Prompt analiz, karşılaştırma, karar verme veya çok aşamalı iş içeriyorsa → **ekle**

**Nasıl uygulanır:**
- Prompt'un karmaşıklık seviyesini analiz et.
- Görevin doğasına göre düşünce zinciri talimatı ekle:
  - Analitik görev → "Önce verileri analiz et, sonra sonuç çıkar..."
  - Karşılaştırma → "Her seçeneğin artı ve eksilerini sırala, sonra öner..."
  - Problem çözme → "Problemi parçalara ayır, her birini ayrı ele al..."
  - Planlama → "Önce mevcut durumu değerlendir, sonra adımları belirle..."

**Kural:** Basit, tek işlemlik prompt'lara zincir düşünce ekleme — gereksiz karmaşıklık yaratır.

### 3. Çıktı Çerçeveleme (Output Framing)

**Ne yapar:** Beklenen çıktının yapısını ve formatını açıkça tanımlar. AI'ın doğru formatta yanıt vermesini sağlar.

**Ne zaman uygulanır (dinamik karar):**
- Orijinal prompt'ta format belirtilmişse → **orijinali koru, gerekirse detaylandır**
- Format belirsizse → **prompt'un amacına en uygun formatı belirle ve ekle**

**Nasıl uygulanır:**
- Prompt'un beklenen çıktı türünü analiz et ve uygun formatı otomatik seç:

| Çıktı türü | Önerilecek format |
|-------------|-------------------|
| Veri, liste, karşılaştırma | Markdown tablo veya numaralı liste |
| Teknik/kod | Kod bloğu + açıklama yorumları |
| Doküman, rapor | Başlıklı bölümler (giriş, gelişme, sonuç) |
| Kısa yanıt | Paragraf veya madde işareti |
| Yapılandırılmış veri | JSON, YAML veya XML |

**Kural:** Formatı her zaman prompt'un amacına göre türet; kullanıcı zaten format belirtmişse onu koru.

### 4. Kısıtlama ve Negatif Talimat (Constraints & Negative Prompting)

**Ne yapar:** Prompt'a "yapılması gerekenlerin" yanı sıra "yapılMAması gerekenleri" de ekler. AI'ın sınırlar içinde kalmasını sağlar.

**Ne zaman uygulanır (dinamik karar):**
- Her prompt'a en az bir kısıtlama ekle (uzunluk, ton veya kapsam).
- Negatif talimat sadece **yaygın hata riski** olan konularda ekle.

**Nasıl uygulanır:**
- Prompt'un konusuna göre olası sapma noktalarını öngör ve kısıtla:

| Prompt türü | Eklenecek kısıtlama örnekleri |
|-------------|-------------------------------|
| İçerik üretme | Ton (resmi/samimi), uzunluk, hedef kitle, kaçınılacak ifadeler |
| Kod yazma | Teknoloji sınırı, performans beklentisi, güvenlik gereksinimleri |
| Analiz/rapor | Derinlik seviyesi, odak alanı, kapsam dışı konular |
| Yaratıcı iş | Stil, tema sınırı, istenmeyen öğeler |

**Kural:** Kısıtlamaları prompt'un potansiyel belirsizlik noktalarından türet, gereksiz kısıtlama ekleme.

### 5. Bağlam Zenginleştirme (Context Enrichment)

**Ne yapar:** Prompt'a eksik olan ama çıktı kalitesini doğrudan etkileyen bağlam bilgilerini ekler.

**Ne zaman uygulanır (dinamik karar):**
- Prompt'ta hedef kitle, alan, amaç veya ön koşul belirtilmemişse → **ekle**
- Prompt zaten yeterli bağlam içeriyorsa → **ekleme**

**Nasıl uygulanır:**
- Adım 2'deki analizden çıkan eksiklere göre şu bilgileri ekle:
  - **Hedef kitle:** Çıktıyı kimin okuyacağı/kullanacağı
  - **Alan/sektör:** Hangi bağlamda kullanılacağı
  - **Ön koşullar:** Önceden bilinen veya varsayılan bilgiler
  - **Başarı kriteri:** Çıktının neye göre "iyi" sayılacağı

**Kural:** Bağlam bilgisini prompt'un analiz sonucundan çıkar; tahmine dayalı bağlam ekleme, belirsizse kullanıcıya sor.

### 6. Örnek Enjeksiyonu (Few-shot Prompting)

**Ne yapar:** Prompt'a örnek girdi/çıktı çiftleri ekleyerek AI'ın beklenen formatı ve kaliteyi anlamasını sağlar.

**Ne zaman uygulanır (dinamik karar):**
- Standart bir görevse (e-posta, özet vb.) → **genelde gereksiz**
- Özel bir format, stil veya yapı isteniyorsa → **ekle**
- Tutarlılık kritikse (veri dönüştürme, şablon çıktı) → **mutlaka ekle**

**Nasıl uygulanır:**
- Prompt'un çıktısında tutarlılık gerektirip gerektirmediğini analiz et.
- Gerekiyorsa bağlama uygun 1-2 kısa örnek oluştur ve prompt'a ekle:
  - "Aşağıdaki formatta yanıt ver: [örnek]"
  - "Girdi: ... → Çıktı: ..."

**Kural:** Örnekleri her zaman prompt'un bağlamından türet. Gereksiz yere örnek ekleme — token israfıdır.

---

## Dil Kuralı

- Prompt geliştirme **Türkçe** yapılır.
- Gelen prompt hangi dilde olursa olsun, iyileştirme açıklamaları ve öneriler Türkçe yazılır.
- Geliştirilmiş prompt'un kendisi, orijinal prompt'un dilinde kalır.

---

## Örnekler

### Örnek 1: Basit → Geliştirilmiş

**Orijinal:**
> Bana bir e-posta yaz

**Geliştirilmiş:**
> Sen profesyonel bir iş iletişimi uzmanısın. Aşağıdaki bilgilere göre resmi ama samimi bir iş e-postası yaz:
>
> - **Alıcı:** Proje müdürü
> - **Konu:** Haftalık ilerleme raporu
> - **Ton:** Profesyonel, net, kısa
> - **İçerik:** Bu haftaki tamamlanan görevler, devam eden işler ve olası riskler
> - **Format:** Kısa paragraflar, madde işaretleri kullan
> - **Uzunluk:** Maksimum 200 kelime

**Yapılan İyileştirmeler:**

| # | İyileştirme | Açıklama |
|---|-------------|----------|
| 1 | Rol tanımı eklendi | "İş iletişimi uzmanı" rolü atandı |
| 2 | Bağlam eklendi | Alıcı, konu, içerik detayları belirtildi |
| 3 | Format belirtildi | Paragraf yapısı ve madde işareti istendi |
| 4 | Kısıtlama eklendi | Ton ve uzunluk sınırı tanımlandı |

---

### Örnek 2: Kodlama Prompt'u

**Orijinal:**
> React'te form yap

**Geliştirilmiş:**
> Sen deneyimli bir React geliştiricisisin. Aşağıdaki gereksinimlere göre bir kayıt formu bileşeni oluştur:
>
> **Gereksinimler:**
> - React + TypeScript kullan
> - Form alanları: ad, soyad, e-posta, şifre
> - Form doğrulama (validation) ekle: e-posta formatı, şifre min 8 karakter
> - Hata mesajlarını alan altında göster
> - Submit durumunda loading state göster
> - Erişilebilirlik (a11y) kurallarına uy
>
> **Kısıtlamalar:**
> - Harici kütüphane kullanma (sadece React hook'ları)
> - Tailwind CSS ile stillendir
> - Tam çalışır, kopyala-yapıştır hazır kod ver

**Yapılan İyileştirmeler:**

| # | İyileştirme | Açıklama |
|---|-------------|----------|
| 1 | Teknoloji stack belirlendi | React + TypeScript + Tailwind |
| 2 | Alan detayları eklendi | Hangi form alanları olacağı belirtildi |
| 3 | Doğrulama kuralları eklendi | Validation gereksinimleri tanımlandı |
| 4 | UX detayları eklendi | Loading state, hata gösterimi |
| 5 | Kısıtlamalar belirtildi | Kütüphane kısıtı, çıktı formatı |

---

## Kalite Kontrol Listesi

Geliştirilmiş prompt'u sunmadan önce şunları doğrula:

- [ ] Hedef açık ve net mi?
- [ ] Yeterli bağlam sağlanmış mı?
- [ ] Çıktı formatı belirtilmiş mi?
- [ ] Kısıtlamalar tanımlı mı?
- [ ] Gereksiz uzunluk veya tekrar var mı?
- [ ] Prompt, orijinalin amacını koruyor mu?
- [ ] İyileştirme özeti anlaşılır mı?
