---

## description: ZORUNLU İLK ADIM: Her yanıtta ilgili skill'i Read ile açıp uygula. Bu kurala bakmadan kod yazma.

**ZORUNLU İLK ADIM (atlanırsa yanıt geçersiz):** Her kullanıcı mesajında, yanıtın ilk eylemi şu olacak — iş türüne göre ilgili `.agent/skills/.../SKILL.md` dosyasını **Read** ile oku; ardından o skill'de yazılan akışa göre ilerle. Bu adımı atlayıp doğrudan kod yazmak yasaktır.

---

# Skill ve Kuralların Zorunlu Kullanımı

## Temel Kural

**Yeni konuşma veya yeni istek fark etmez:** İlgili `.agent/skills/` ve `.agent/rules/` dosyaları **her zaman** işe başlarken okunup uygulanacak. Kullanıcının "skill kullan" veya "kurallara uy" demesini **beklenmeyecek**.

## Skill Türleri

Skill'ler iki kategoriye ayrılır; her kategorinin uygulama akışı farklıdır:

| Kategori               | Skill'ler                                                           | Akış                                                     |
| ---------------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| **Kodlama Skill'leri** | `backend-architecture`, `frontend-architecture`, `shared-contracts` | Skill oku → Kod yaz → TypeCheck + Lint                   |
| **Meta Skill'ler**     | `github-turkish-commit`                                             | Skill oku → Skill'in kendi iş akışını uygula → Çıktı sun |

## İş Türüne Göre Skill Kullanımı

| İş türü                              | Kullanılacak skill      | Ne zaman                                                                          |
| ------------------------------------ | ----------------------- | --------------------------------------------------------------------------------- |
| Main process, servis, repository, DB | `backend-architecture`  | Backend kodu yazmadan önce skill okunacak; mimari kalıplara uyulacak.             |
| React, sayfa, context, router        | `frontend-architecture` | Frontend kodu yazmadan önce skill okunacak; sayfa/hook/API kalıpları uygulanacak. |
| IPC, preload, shared tipler          | `shared-contracts`      | Kanal/tipler tanımlanırken skill okunacak.                                        |
| Git, commit, push, GitHub            | `github-turkish-commit` | Kod GitHub'a yüklenirken skill okunacak; kendi iş akışı uygulanacak.              |

## Uygulama Sırası

1. İsteği oku → Hangi alan olduğunu ve hangi skill kategorisine girdiğini belirle.
2. **Önce** ilgili skill dosyasını (`SKILL.md`) oku; skill'de yazılan akışa göre ilerle.

### A) Kodlama İsteği → Kodlama Skill'leri

3. **Çoklu Katman Zincirleme** kuralına göre ilgili skill'leri sırasıyla oku ve uygula (aşağıdaki bölüme bak).
4. `.agent/rules/` (project-coding-standards, ilgili strict kurallar) ile uyumlu kod yaz.
5. Doğrulama: TypeCheck ve Lint mutlaka çalıştır.

### B) Meta Skill'ler (github-turkish-commit vb.)

3. Skill'in kendi iş akışını uygula.
4. Çıktıyı skill'de tanımlanan formatta sun. Kod yazılmıyorsa TypeCheck/Lint **atlanır**.

### C) Çoklu Katman Zincirleme (Multi-Layer Chaining)

Bir özellik birden fazla katmanı etkiliyorsa (örn. yeni modül: shared + backend + frontend + UI), her katmanın skill'i **bağımlılık sırasıyla** okunur ve uygulanır:

```
1. shared-contracts   → Tipler ve sabitler (her zaman ilk)
2. backend-architecture → Repository + Service + IPC (tiplere bağlı)
3. frontend-architecture → API katmanı + sayfa + route (backend'e bağlı)
4. ui-ux-pro-max       → Bileşen tasarımı ve UX (frontend'e bağlı)
```

**Kurallar:**

- Her katmana geçmeden önce o katmanın skill'i **Read** ile okunur.
- Yalnızca etkilenen katmanların skill'leri okunur; etkilenmeyen katman atlanır.
- Eğer sadece tek katman etkileniyorsa (örn. sadece UI düzeltmesi) zincir uygulanmaz, doğrudan ilgili skill okunur.
- Her katmanın kodu yazıldıktan sonra bir sonraki katmana geçilir (katmanlar arası bağımlılık korunur).

**Örnek — Yeni modül ekleme:**

1. `shared-contracts` oku → `{modul}.types.ts` oluştur, `constants.ts` güncelle
2. `backend-architecture` oku → Repository + Service oluştur, `index.ts`'e kaydet
3. `frontend-architecture` oku → `api.ts`'e endpoint ekle, sayfa bileşeni oluştur, route ekle
4. `ui-ux-pro-max` oku → Bileşen tasarımı, stil, UX kontrolleri
5. TypeCheck + Lint çalıştır

**Örnek — Sadece frontend değişikliği:**

1. `frontend-architecture` oku → Değişikliği uygula
2. UI bileşeni varsa `ui-ux-pro-max` oku → Stil/UX kontrolleri
3. TypeCheck + Lint çalıştır

## Yasak

- "Kullanıcı söylemediği için skill/kural kullanmadım" **kabul edilmez**.
- Skill veya kuralı yalnızca kullanıcı açıkça istediğinde devreye sokmak **yasaktır**; varsayılan davranış her zaman uyumdur.
- Saf meta skill'lere kodlama doğrulaması (TypeCheck/Lint) uygulamak **yasaktır** — gereksiz token israfıdır. Kodlama skill'leri ile implementasyon yapıldığında TypeCheck/Lint **zorunludur**.
