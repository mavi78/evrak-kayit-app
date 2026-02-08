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

| İş Türü | Skill Dosyası | Ne Zaman Kullanılır |
|----------|---------------|---------------------|
| UI/UX, tasarım, görünüm | `.cursor/skills/ui-ux-pro-max/SKILL.md` | Herhangi bir UI bileşeni veya sayfa tasarımı yapılırken |
| Backend, servis, veritabanı | `.cursor/skills/backend-architecture/SKILL.md` | Main process, repository, servis kodu yazılırken |
| Frontend, React, sayfa | `.cursor/skills/frontend-architecture/SKILL.md` | Renderer process, sayfa, hook, context yazılırken |
| IPC, preload, ortak tipler | `.cursor/skills/shared-contracts/SKILL.md` | IPC kanalı, tip tanımı, preload bridge düzenlenirken |

### Skill Şablonları

- `.cursor/skills/frontend-architecture/templates/data-display.md`
- `.cursor/skills/shared-contracts/templates/type-examples.md`
- `.cursor/skills/backend-architecture/templates/database-patterns.md`
- `.cursor/skills/backend-architecture/templates/auth-example.md`

---

## Temel Prensipler

1. **Önce oku, sonra yaz**: Kod yazmadan önce ilgili skill ve kural dosyaları okunacak.
2. **Türkçe iletişim**: Kullanıcı ile her zaman Türkçe konuşulacak; kod içi isimler İngilizce kalacak.
3. **JSDoc Türkçe**: Tüm JSDoc açıklamaları Türkçe yazılacak.
4. **Doğrulama zorunlu**: Her kod değişikliğinden sonra `npx tsc --noEmit` ve `npx eslint .` çalıştırılacak.
5. **Onay akışı**: Büyük değişiklikler uygulanmadan önce kullanıcıdan onay alınacak.
6. **OOP & Modüler mimari**: Katmanlı, sınıf tabanlı, tek sorumluluk ilkesine uygun kod yazılacak.
7. **DRY**: Tekrar eden mantık ortak modüllere çıkarılacak.

---

**Bu kurallara uymayan hiçbir kod değişikliği kabul edilmez.**
