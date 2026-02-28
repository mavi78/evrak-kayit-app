import { Database } from '@main/database/Database'
import { Logger } from '@main/core/Logger'
import type BetterSqlite3 from 'better-sqlite3'

export class AutocompleteRepository {
  private db: BetterSqlite3.Database
  private logger: Logger

  constructor() {
    this.db = Database.getInstance().getConnection()
    this.logger = Logger.getInstance()
    this.initializeTables()
  }

  private initializeTables(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS autocomplete_suggestions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          field TEXT NOT NULL,
          value TEXT NOT NULL,
          UNIQUE(field, value)
        )
      `)
    } catch (err: unknown) {
      this.logger.error(
        'Tablo oluşturulamadı (autocomplete_suggestions)',
        err instanceof Error ? err : new Error(String(err)),
        'AutocompleteRepository'
      )
    }
  }

  /**
   * Yeni bir öneri ekler. Varsa hata atmaz (INSERT OR IGNORE).
   * @param field 'source_office' veya 'subject'
   * @param value Eklenecek değer
   */
  addSuggestion(field: string, value: string): boolean {
    try {
      if (!value || !value.trim()) return false

      const val = value.trim()
      const stmt = this.db.prepare(
        'INSERT OR IGNORE INTO autocomplete_suggestions (field, value) VALUES (?, toUpperCaseTr(?))'
      )

      stmt.run(field, val)
      return true
    } catch (err: unknown) {
      this.logger.error(
        `Öneri eklenirken hata: ${field} - ${value}`,
        err instanceof Error ? err : new Error(String(err)),
        'AutocompleteRepository'
      )
      return false
    }
  }

  /**
   * Belirtilen alanda arama yapar. Türkçe karakter duyarlı eşleştirme.
   * @param field 'source_office' veya 'subject'
   * @param query Aranacak metin
   * @param limit En fazla kaç kayıt dönsün (varsayılan: 20)
   */
  search(field: string, query: string, limit = 20): string[] {
    try {
      if (!query || query.trim().length < 3) return []

      // toLowerCaseTr DB'de özel fonksiyondur (Database.ts'te tanımlı)
      const stmt = this.db.prepare(`
        SELECT value FROM autocomplete_suggestions 
        WHERE field = ? AND toLowerCaseTr(value) LIKE '%' || toLowerCaseTr(?) || '%' 
        ORDER BY value ASC 
        LIMIT ?
      `)

      const rows = stmt.all(field, query.trim(), limit) as { value: string }[]
      return rows.map((r) => r.value)
    } catch (err: unknown) {
      this.logger.error(
        `Arama yapılırken hata: ${field} - ${query}`,
        err instanceof Error ? err : new Error(String(err)),
        'AutocompleteRepository'
      )
      return []
    }
  }
}
