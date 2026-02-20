# Proje Kod Yazma Standartları

> **Description:** Proje geneli kod yazma standartları - isimlendirme, mimari, iletişim ve iş akışı kuralları

## 1. İsimlendirme Kuralları

Tüm isimler İngilizce, tutarlı ve anlamlı olmalıdır.

| Öğe            | Kural                           | Örnek                               |
| -------------- | ------------------------------- | ----------------------------------- |
| Dosya (modül)  | camelCase veya kebab-case       | `userService.ts`, `auth-helper.ts`  |
| Klasör         | kebab-case                      | `user-management/`, `shared-utils/` |
| Değişken       | camelCase                       | `userName`, `isActive`              |
| Sabit          | UPPER_SNAKE_CASE                | `MAX_RETRY_COUNT`, `API_BASE_URL`   |
| Fonksiyon      | camelCase, fiil ile başlar      | `getUserById()`, `calculateTotal()` |
| Sınıf          | PascalCase                      | `UserService`, `DocumentParser`     |
| Interface/Type | PascalCase, "I" prefix yok      | `UserProfile`, `ApiResponse`        |
| Enum           | PascalCase, üyeleri UPPER_SNAKE | `enum Status { ACTIVE, INACTIVE }`  |

## 2. JSDoc Açıklamaları Türkçe Yazılacak

```typescript
/**
 * Kullanıcıyı veritabanından ID ile getirir.
 * @param id - Kullanıcının benzersiz kimliği
 * @returns Bulunan kullanıcı nesnesi veya null
 * @throws {DatabaseError} Veritabanı bağlantı hatası durumunda
 */
function getUserById(id: string): Promise<User | null> {
  // ...
}
```

## 3. Mimari Prensipler

- **OOP & Modüler**: Kodlar sınıf tabanlı, modüler ve katmanlı mimaride yazılacak.
- **Single Responsibility**: Her fonksiyon/sınıf yalnızca tek bir işten sorumlu olacak.
- **DRY (Don't Repeat Yourself)**: Aynı işi yapan birden fazla fonksiyon, sınıf veya modül yazılmayacak. Tekrar eden mantık ortak bir yere çıkarılacak.
- **Optimizasyon**: Gereksiz döngü, hesaplama ve bellek kullanımından kaçınılacak.

## 4. Kullanıcı İletişim Dili

Kullanıcı ile **her zaman Türkçe** konuşulacak. Kod içi isimler İngilizce kalacak, ancak tüm açıklamalar, commit mesajları ve kullanıcıya yönelik çıktılar Türkçe olacak.

## 5. İş Akışı — Önce Netleştir, Sonra Planla, Sonra Kodla

**İlk adım (atlanırsa iş geçersiz):** İlgili skill dosyasını (`.agent/skills/.../SKILL.md`) **Read** ile aç ve uygula. Bu yapılmadan analiz/kod yazılmaz.

Bir kodlama isteği geldiğinde şu adımlar izlenecek:

1. **Kodlama Skill'leri (Zorunlu — Bağımlılık Sırasıyla)**: Etkilenen her katmanın skill'i **bağımlılık sırasıyla** okunup uygulanır:
   - `shared-contracts` → `backend-architecture` → `frontend-architecture` → `ui-ux-pro-max`
   - Sadece etkilenen katmanların skill'leri okunur; etkilenmeyen katman atlanır.
   - Her katman kodlanmadan önce o katmanın skill'i **Read** ile okunur.
   - Detaylar: `always-use-skills-and-rules.md` > Çoklu Katman Zincirleme bölümü.
2. **Uygulama**: İlgili skill'lerin akışına göre, katman bağımlılık sırasıyla kodlama yapılır.
3. **Doğrulama (Zorunlu)**: Kod değişiklikleri tamamlandıktan sonra aşağıdaki kontroller **mutlaka** yapılacak:
   - **TypeCheck**: `npm run typecheck` komutu çalıştırılarak tip hataları kontrol edilecek. (Proje iki tsconfig kullanır: `tsconfig.node.json` — Main/Preload/Shared, `tsconfig.web.json` — Renderer/Shared. Tek `npx tsc --noEmit` çalışmaz.)
   - **Lint**: `npm run lint` komutu çalıştırılarak lint hataları kontrol edilecek.
   - Hata bulunursa düzeltilmeden işlem tamamlanmış sayılmayacak.

## 6. Yasaklı API'ler — Katı

- **`alert()` ve `window.confirm()` KESİNLİKLE YASAKTIR.**
  - Kullanıcıya bilgi vermek için `@mantine/notifications` (`showError`, `showSuccess`) kullanılır.
  - Onay işlemleri için Mantine `Modal` bileşeni veya `@mantine/modals` kullanılır.
  - Tarayıcı native diyalogları, uygulamanın native hissini bozar ve renderer process'i bloklar.

Belirsiz veya birden fazla yaklaşım mümkünse, kullanıcıya seçenekler sunulacak.
