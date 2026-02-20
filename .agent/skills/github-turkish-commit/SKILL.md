---
name: github-turkish-commit
description: Git değişikliklerini analiz edip Türkçe conventional commit mesajı oluşturur, uygun branch önerir ve GitHub'a push eder. Kullanıcı "GitHub'a yükle", "commit at", "push et", "kodu gönder" veya benzeri ifadeler kullandığında tetiklenir.
---

# GitHub Türkçe Commit & Push

Kullanıcı kodu GitHub'a yüklemek istediğinde bu iş akışını takip et.

## Conventional Commit Prefix Tablosu (Türkçe)

| Prefix     | Kullanım                     | Türkçe Açıklama Örneği                                  |
| ---------- | ---------------------------- | ------------------------------------------------------- |
| `feat`     | Yeni özellik                 | `feat(auth): kullanıcı giriş sayfası eklendi`           |
| `fix`      | Hata düzeltme                | `fix(tablo): sayfalama hatası giderildi`                |
| `refactor` | Kod yeniden yapılandırma     | `refactor(api): servis katmanı sadeleştirildi`          |
| `style`    | Görsel/CSS değişiklikleri    | `style(header): menü hizalaması düzeltildi`             |
| `docs`     | Dokümantasyon                | `docs(readme): kurulum adımları güncellendi`            |
| `test`     | Test ekleme/düzenleme        | `test(auth): login servisi testleri eklendi`            |
| `chore`    | Yapılandırma/bağımlılık      | `chore(deps): electron sürümü güncellendi`              |
| `perf`     | Performans iyileştirme       | `perf(liste): sanal kaydırma ile liste optimize edildi` |
| `ci`       | CI/CD değişiklikleri         | `ci(github): build pipeline eklendi`                    |
| `build`    | Build sistemi değişiklikleri | `build(vite): üretim yapılandırması güncellendi`        |

## İş Akışı

### Adım 1: Durum Analizi

Aşağıdaki komutları **paralel** çalıştır:

```bash
git status
git diff --staged
git diff
git log --oneline -5
git branch --show-current
```

### Adım 2: Branch Değerlendirmesi

Mevcut branch'i kontrol et. Eğer `main` veya `master` üzerindeyse ve değişiklikler yeni bir özellik/düzeltme içeriyorsa, uygun branch öner:

| Değişiklik Tipi      | Branch Formatı           | Örnek                     |
| -------------------- | ------------------------ | ------------------------- |
| Yeni özellik         | `feature/kisa-aciklama`  | `feature/kullanici-giris` |
| Hata düzeltme        | `fix/kisa-aciklama`      | `fix/tablo-sayfalama`     |
| Yeniden yapılandırma | `refactor/kisa-aciklama` | `refactor/servis-katmani` |
| Acil düzeltme        | `hotfix/kisa-aciklama`   | `hotfix/login-cokme`      |

Branch adları: küçük harf, Türkçe karakter yok (ç→c, ş→s, ğ→g, ü→u, ö→o, ı→i), kelimeler tire ile ayrılsın.

**Kullanıcıya branch önerisi sun.** Kabul ederse oluştur, reddederse mevcut branch'te devam et.

### Adım 3: Değişiklikleri Analiz Et

`git diff` ve `git status` çıktılarını analiz ederek:

1. Hangi dosyalar değişmiş, eklenmiş veya silinmiş?
2. Değişiklik hangi modüle ait? (scope belirle)
3. Değişikliğin amacı ne? (feat/fix/refactor vb.)
4. Birden fazla bağımsız değişiklik varsa ayrı commit'lere böl.

### Adım 4: Commit Mesajı Oluştur

Format:

```
<prefix>(<scope>): <özet>

<detaylı açıklama - isteğe bağlı>
```

**Kurallar:**

- Özet: Küçük harfle başla, sonuna nokta koyma, max 72 karakter
- Scope: Değişen modül adı (auth, evrak, tablo, header vb.)
- Detay: Neden bu değişiklik yapıldı, ne etkilendi (2+ dosya değiştiyse ekle)
- Dil: Tamamen Türkçe yaz
- Birden fazla bağımsız değişiklik varsa ayrı commit'ler oluştur

**Güvenlik:** `.env`, `credentials`, `secret`, `token` içeren dosyaları **asla commit'leme**. Varsa kullanıcıyı uyar.

### Adım 5: Stage & Commit

```bash
# İlgili dosyaları stage'e al
git add <dosyalar>

# Commit at (HEREDOC ile)
git commit -m "$(cat <<'EOF'
feat(auth): kullanıcı giriş sayfası eklendi

JWT tabanlı kimlik doğrulama ve oturum yönetimi entegre edildi
EOF
)"
```

### Adım 6: Push

Commit başarılı olduktan sonra **otomatik push** yap:

```bash
# Remote branch yoksa upstream ayarla
git push -u origin HEAD
```

Push başarılı olduktan sonra kullanıcıya bilgi ver:

- Commit mesajını göster
- Push edilen branch adını belirt
- Varsa GitHub PR linki öner

### Hata Durumları

| Hata                      | Çözüm                                                  |
| ------------------------- | ------------------------------------------------------ |
| Pre-commit hook başarısız | Hatayı düzelt, **yeni commit** oluştur (amend yapma)   |
| Push reddedildi           | `git pull --rebase` ile güncelle, sonra tekrar push et |
| Merge conflict            | Kullanıcıyı bilgilendir, çözüm için yardım öner        |
| Remote yok                | `git remote add origin <url>` ile ekle                 |

## Birden Fazla Değişiklik Örneği

Eğer farklı modüllerde bağımsız değişiklikler varsa:

```bash
# 1. Commit: Auth değişiklikleri
git add src/auth/
git commit -m "$(cat <<'EOF'
feat(auth): oturum yönetimi eklendi
EOF
)"

# 2. Commit: UI düzeltmeleri
git add src/renderer/components/
git commit -m "$(cat <<'EOF'
style(ui): header bileşeni hizalaması düzeltildi
EOF
)"

# Tüm commit'leri tek seferde push et
git push -u origin HEAD
```
