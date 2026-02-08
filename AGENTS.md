# AI Agent Kuralları — Evrak Kayıt App

> **Bu dosya her yeni konuşmada AI ajanları tarafından okunmalıdır.**
> Aşağıdaki kural ve skill dosyalarına **harfiyen** uyulması zorunludur.

---

## Zorunlu Kural Dosyaları (`.cursor/rules/`)

Aşağıdaki kural dosyaları her zaman geçerlidir. Her konuşma başlangıcında okunup uygulanacaktır:

| Dosya | Açıklama |
|-------|----------|
| `.cursor/rules/always-use-skills-and-rules.mdc` | Skill ve kuralların her zaman kullanılmasını zorunlu kılar |
| `.cursor/rules/project-coding-standards.mdc` | Proje genelinde isimlendirme, mimari, iş akışı standartları |
| `.cursor/rules/ipc-communication-rules.mdc` | IPC iletişim kuralları ve güvenlik kalıpları |
| `.cursor/rules/frontend-strict-rules.mdc` | Frontend katmanı için zorunlu kurallar |
| `.cursor/rules/backend-strict-rules.mdc` | Backend katmanı için zorunlu kurallar |
| `.cursor/rules/typescript-strict-types.mdc` | TypeScript tip güvenliği kuralları |

---

## Zorunlu Skill Dosyaları (`.cursor/skills/`)

İş türüne göre aşağıdaki skill dosyaları **işe başlamadan önce** okunup uygulanacaktır:

### Kodlama Skill'leri

Kod yazan, dosya oluşturan veya düzenleyen skill'ler. Akış: **Skill oku → Kod yaz → TypeCheck + Lint**

| İş Türü | Skill Dosyası | Ne Zaman Kullanılır |
|----------|---------------|---------------------|
| UI/UX, tasarım, görünüm | `.cursor/skills/ui-ux-pro-max/SKILL.md` | Herhangi bir UI bileşeni veya sayfa tasarımı yapılırken |
| Backend, servis, veritabanı | `.cursor/skills/backend-architecture/SKILL.md` | Main process, repository, servis kodu yazılırken |
| Frontend, React, sayfa | `.cursor/skills/frontend-architecture/SKILL.md` | Renderer process, sayfa, hook, context yazılırken |
| IPC, preload, ortak tipler | `.cursor/skills/shared-contracts/SKILL.md` | IPC kanalı, tip tanımı, preload bridge düzenlenirken |

### Hibrit Skill'ler

Meta akışla başlayıp, kullanıcı onayı ile kodlama akışına geçebilen skill'ler. Akış: **Skill oku → Kendi akışını uygula → Belirsizlikleri gider → Onay al → (opsiyonel) Kodlama skill'lerini kullanarak implementasyona geç → TypeCheck + Lint**

| İş Türü | Skill Dosyası | Ne Zaman Kullanılır |
|----------|---------------|---------------------|
| Prompt geliştirme, iyileştirme | `.cursor/skills/prompt-enhancer/SKILL.md` | Kullanıcı prompt geliştirmek, iyileştirmek veya optimize etmek istediğinde. Prompt geliştirildikten sonra belirsizlikler giderilip onay alınırsa kodlama skill'leri ile implementasyona geçilir. |

### Meta Skill'ler

Kod yazmayan, kendi iş akışına sahip skill'ler. Akış: **Skill oku → Kendi akışını uygula → Çıktı sun**

| İş Türü | Skill Dosyası | Ne Zaman Kullanılır |
|----------|---------------|---------------------|
| Git, commit, push, GitHub | `.cursor/skills/github-turkish-commit/SKILL.md` | Kod GitHub'a yüklenirken, commit atılırken, push edilirken |

### Skill Şablonları

- `.cursor/skills/frontend-architecture/templates/data-display.md`
- `.cursor/skills/shared-contracts/templates/type-examples.md`
- `.cursor/skills/backend-architecture/templates/database-patterns.md`
- `.cursor/skills/backend-architecture/templates/auth-example.md`

---

## Temel Prensipler

### Tüm Skill'ler İçin Geçerli

1. **Önce oku, sonra yaz**: İlgili skill ve kural dosyaları işe başlamadan önce okunacak.
2. **Türkçe iletişim**: Kullanıcı ile her zaman Türkçe konuşulacak; kod içi isimler İngilizce kalacak.
3. **Onay akışı**: Büyük değişiklikler uygulanmadan önce kullanıcıdan onay alınacak.

### Yalnızca Kodlama Skill'leri İçin Geçerli

4. **JSDoc Türkçe**: Tüm JSDoc açıklamaları Türkçe yazılacak.
5. **Doğrulama zorunlu**: Her kod değişikliğinden sonra `npm run typecheck` ve `npm run lint` çalıştırılacak.
6. **OOP & Modüler mimari**: Katmanlı, sınıf tabanlı, tek sorumluluk ilkesine uygun kod yazılacak.
7. **DRY**: Tekrar eden mantık ortak modüllere çıkarılacak.

### Yalnızca Hibrit Skill'ler İçin Geçerli

8. **Kendi iş akışı + implementasyon**: Önce meta akış (prompt geliştirme), ardından onay alınırsa kodlama akışı uygulanır.
9. **Onay zorunlu**: İmplementasyona geçmeden önce belirsizlikler giderilir ve kullanıcıdan açık onay alınır.
10. **Koşullu doğrulama**: Yalnızca prompt teslim ediliyorsa TypeCheck/Lint atlanır; implementasyona geçiliyorsa TypeCheck/Lint **zorunludur**.

### Yalnızca Meta Skill'ler İçin Geçerli

11. **Kendi iş akışı**: Her meta skill'in `SKILL.md` dosyasında tanımlı iş akışı uygulanır.
12. **TypeCheck/Lint atlanır**: Kod yazılmıyorsa doğrulama adımları uygulanmaz.
13. **Çıktı formatı**: Skill'de tanımlanan çıktı formatına uyulur.

---

**Bu kurallara uymayan hiçbir kod değişikliği veya skill çıktısı kabul edilmez.**
