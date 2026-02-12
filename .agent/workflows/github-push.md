---
description: GitHub'a Türkçe conventional commit ile push etme iş akışı
---

# GitHub'a Push Etme

Kod değişikliklerini GitHub'a yüklerken aşağıdaki adımlar takip edilir.

## 1. Skill Dosyasını Oku

- `.agent/skills/github-turkish-commit/SKILL.md` dosyasını oku
- Skill'deki iş akışını uygula

## 2. Değişiklikleri İncele

// turbo
2a. Mevcut değişiklikleri kontrol et:

```
git status
```

// turbo
2b. Değişikliklerin detayını gör:

```
git diff --stat
```

## 3. Commit Mesajı Oluştur

Türkçe conventional commit formatında mesaj oluştur:

```
<tip>(<kapsam>): <açıklama>

[isteğe bağlı gövde]
```

**Tipler:** `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `test`, `perf`

**Kurallar:**

- Açıklama Türkçe yazılır
- Kapsam modül/katman adıdır (örn: `auth`, `document`, `ui`)
- İlk harf küçük, nokta ile bitmez

## 4. Stage ve Commit

4a. Dosyaları stage'e ekle:

```
git add .
```

4b. Commit oluştur:

```
git commit -m "<commit mesajı>"
```

## 5. Push

5a. Uzak repoya gönder:

```
git push origin <branch>
```

## 6. Branch Önerisi

Skill tarafından uygun branch adı önerilir. Yeni branch gerekiyorsa:

```
git checkout -b <branch-adi>
```
