# Veritabanı Şema ve Sorgu Kalıpları

## SQLite Şema Tasarım Kuralları

### Tablo Standartları

Her tablo şu alanları **zorunlu** içerir:

```sql
CREATE TABLE IF NOT EXISTS table_name (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- ... modül alanları ...
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
```

### Veri Tipi Eşleştirmesi

| TypeScript | SQLite                | Kural                                      |
| ---------- | --------------------- | ------------------------------------------ |
| `number`   | `INTEGER` veya `REAL` | Tam sayı: INTEGER, ondalık: REAL           |
| `string`   | `TEXT`                | Her zaman TEXT (VARCHAR yok)               |
| `boolean`  | `INTEGER`             | `CHECK(col IN (0, 1))` + getBooleanColumns |
| `Date`     | `TEXT`                | `datetime('now', 'localtime')` format      |
| `enum`     | `TEXT`                | `CHECK(col IN ('val1', 'val2'))`           |

### Boolean Alan Kuralı

SQLite'da boolean yoktur. `INTEGER` + `CHECK` constraint kullanılır:

```sql
-- Tabloda
is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))

-- Repository'de getBooleanColumns override et
protected override getBooleanColumns(): readonly string[] {
  return ['is_active']
}
```

### Foreign Key Tanımı

```sql
-- Her zaman ON DELETE davranışı belirt
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
FOREIGN KEY (granted_by) REFERENCES users(id)  -- varsayılan: RESTRICT
```

### UNIQUE Constraint

```sql
-- Tek kolon
username TEXT UNIQUE NOT NULL

-- Bileşik UNIQUE
UNIQUE(user_id, page_key)
```

---

## Sorgu Kalıpları

### Parameterized Query (Zorunlu)

```typescript
// ✅ DOĞRU — parameterized
const stmt = this.db.prepare(`SELECT * FROM users WHERE username = ?`)
stmt.get(username)

// ✅ Çoklu parametre
const stmt = this.db.prepare(`SELECT * FROM users WHERE role = ? AND is_active = ?`)
stmt.all(role, isActive ? 1 : 0)

// ❌ YASAK — SQL injection riski
this.db.prepare(`SELECT * FROM users WHERE username = '${username}'`)
```

### Sıralama

```typescript
// Varsayılan: yeniden eskiye (BaseRepository.findAll)
;`SELECT * FROM ${this.getTableName()} ORDER BY id DESC`
// Özel sıralama
`SELECT * FROM table_name ORDER BY created_at DESC, title ASC`
```

### Sayfalama

```typescript
findPaginated(page: number, limit: number): { items: T[]; total: number } {
  return this.safeExecute(() => {
    const offset = (page - 1) * limit
    const items = this.db.prepare(
      `SELECT * FROM ${this.getTableName()} ORDER BY id DESC LIMIT ? OFFSET ?`
    ).all(limit, offset) as Record<string, unknown>[]

    const { total } = this.db.prepare(
      `SELECT COUNT(*) as total FROM ${this.getTableName()}`
    ).get() as { total: number }

    return { items: this.toAppModels(items), total }
  })
}
```

### Arama (LIKE)

```typescript
search(query: string): T[] {
  return this.safeExecute(() => {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.getTableName()}
       WHERE title LIKE ? OR description LIKE ?
       ORDER BY id DESC`
    )
    const pattern = `%${query}%`
    return this.toAppModels(stmt.all(pattern, pattern) as Record<string, unknown>[])
  })
}
```

### Transaction

```typescript
// Birden fazla işlemi atomik yapmak için
transferDocument(fromId: number, toId: number): void {
  this.safeTransaction(() => {
    this.db.prepare(`UPDATE documents SET status = 'transferred' WHERE id = ?`).run(fromId)
    this.db.prepare(`INSERT INTO transfers (from_id, to_id) VALUES (?, ?)`).run(fromId, toId)
    // Hata olursa tüm işlem geri alınır
  })
}
```

---

## Database Singleton Yapılandırması

```typescript
// Mevcut pragma ayarları (ağ paylaşımı uyumlu)
journal_mode = DELETE // WAL yerine DELETE (ağ güvenli)
busy_timeout = 10000 // 10sn bekle (ağ gecikmesi)
foreign_keys = ON // Referans bütünlüğü
synchronous = NORMAL // Performans/güvenlik dengesi
```

### Veritabanı Dosya Konumu

```
Geliştirme: {app_path}/data/evrak-kayit.db
Üretim:     {exe_dir}/data/evrak-kayit.db
```
