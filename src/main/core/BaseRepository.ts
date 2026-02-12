// ============================================================
// BaseRepository - Tüm repository sınıflarının temel sınıfı
//
// Sorumlulukları:
// 1. Standart CRUD - Alt sınıflarda tekrar yazılmaz
// 2. Güvenli çalıştırma (safeExecute) - DB hataları otomatik çevrilir
// 3. Boolean dönüşüm - SQLite (0/1) <-> TypeScript (boolean)
// 4. Tablo oluşturma - Her modül kendi tablolarını tanımlar
// 5. Transaction desteği - Çoklu işlemler atomik yapılır
//
// Yeni modül eklemek:
//   - tableName, tableSchemas tanımla
//   - booleanColumns ile boolean alanları belirt
//   - Özel sorgular için safeExecute kullan
// ============================================================

import BetterSqlite3 from 'better-sqlite3'
import { Database } from '@main/database/Database'
import { formatForDatabase } from '@shared/utils'
import { AppError } from './AppError'
import { Logger } from './Logger'
import type { BaseEntity } from '@shared/types'

export abstract class BaseRepository<T extends BaseEntity> {
  protected db: BetterSqlite3.Database
  protected logger: Logger

  /**
   * Abstract METOD olarak tanımlanır (property değil).
   * Neden: Base constructor çalışırken alt sınıfın property'leri henüz
   * initialize edilmez. Metod ise prototype chain üzerinden erişilebilir.
   */

  /** Ana tablo adı */
  protected abstract getTableName(): string

  /** CREATE TABLE IF NOT EXISTS ... sorguları - her repo kendi tablolarını tanımlar */
  protected abstract getTableSchemas(): readonly string[]

  /** Boolean dönüşümü yapılacak kolon adları (SQLite 0/1 <-> TS boolean) */
  protected getBooleanColumns(): readonly string[] {
    return []
  }

  /** Text formatlamasından hariç tutulacak kolon adları (password, tc_kimlik_no, role vb.) */
  protected getExcludedTextColumns(): readonly string[] {
    return ['password', 'tc_kimlik_no', 'id', 'created_at', 'updated_at', 'role', 'document_type']
  }

  constructor() {
    this.db = Database.getInstance().getConnection()
    this.logger = Logger.getInstance()
    this.initializeTables()
  }

  // ================================================================
  // TABLO OLUŞTURMA
  // ================================================================

  /** Modülün tablolarını oluşturur (yoksa) */
  private initializeTables(): void {
    this.safeTransaction(() => {
      for (const schema of this.getTableSchemas()) {
        this.db.exec(schema)
      }
    })
    this.logger.debug(`Tablolar hazır: ${this.getTableName()}`, 'BaseRepository')
  }

  // ================================================================
  // BOOLEAN DÖNÜŞÜM - SQLite (INTEGER 0/1) <-> TypeScript (boolean)
  // ================================================================

  /** DB satırını uygulama modeline dönüştürür (0/1 -> true/false) */
  protected toAppModel(row: Record<string, unknown>): T {
    if (!row) return row as unknown as T
    const result = { ...row }
    for (const col of this.getBooleanColumns()) {
      if (col in result) {
        result[col] = result[col] === 1
      }
    }
    return result as unknown as T
  }

  /** Birden fazla satırı dönüştürür */
  protected toAppModels(rows: Record<string, unknown>[]): T[] {
    return rows.map((row) => this.toAppModel(row))
  }

  /** Farklı bir model tipi için boolean dönüşüm (PagePermission vb.) */
  protected toBooleans<U>(row: Record<string, unknown>, boolCols: readonly string[]): U {
    if (!row) return row as U
    const result = { ...row }
    for (const col of boolCols) {
      if (col in result) {
        result[col] = result[col] === 1
      }
    }
    return result as U
  }

  /**
   * SQLite toUpperCaseTr fonksiyonunu kullanarak string'i büyük harfe çevirir
   */
  protected toUpperCaseTr(value: string): string {
    if (!value || value.trim().length === 0) return value
    const stmt = this.db.prepare('SELECT toUpperCaseTr(?) as upper')
    return (stmt.get(value) as { upper: string }).upper
  }

  /**
   * SQLite capitalizeTr fonksiyonunu kullanarak string'in sadece baş harfini büyük yapar
   */
  protected capitalizeTr(value: string): string {
    if (!value || value.trim().length === 0) return value
    const stmt = this.db.prepare('SELECT capitalizeTr(?) as cap')
    return (stmt.get(value) as { cap: string }).cap
  }

  /**
   * String'i normalize eder: baş/son boşlukları temizler, çoklu boşlukları tek boşluğa indirir
   */
  private normalizeText(value: string): string {
    if (!value || typeof value !== 'string') return ''
    // Baştaki ve sondaki boşlukları temizle
    let normalized = value.trim()
    // Birden fazla boşluğu tek boşluğa indir
    normalized = normalized.replace(/\s+/g, ' ')
    return normalized
  }

  /** Uygulama verisini DB modeline dönüştürür (true/false -> 0/1, text -> normalize + büyük harf) */
  protected toDbModel(data: Record<string, unknown>): Record<string, unknown> {
    const result = { ...data }
    const excludedCols = this.getExcludedTextColumns()
    
    // Boolean dönüşümü
    for (const col of this.getBooleanColumns()) {
      if (col in result && typeof result[col] === 'boolean') {
        result[col] = result[col] ? 1 : 0
      }
    }
    
    // Text alanlarını normalize et ve büyük harfe çevir (hariç tutulanlar dışında)
    for (const key in result) {
      if (
        typeof result[key] === 'string' &&
        result[key] !== null &&
        !excludedCols.includes(key)
      ) {
        const value = result[key] as string
        // Önce normalize et (boşlukları temizle)
        const normalized = this.normalizeText(value)
        // Normalize edilmiş değer varsa büyük harfe çevir, yoksa boş string bırak
        if (normalized.length > 0) {
          result[key] = this.toUpperCaseTr(normalized)
        } else {
          result[key] = ''
        }
      }
    }
    
    return result
  }

  // ================================================================
  // GÜVENLİ ÇALIŞTIRMA - DB hataları otomatik AppError'a çevrilir
  // ================================================================

  /**
   * Tek DB işlemini güvenli çalıştırır.
   * SQLite hataları (UNIQUE, FK, BUSY vb.) anlamlı AppError'a çevrilir.
   */
  protected safeExecute<R>(fn: () => R): R {
    try {
      return fn()
    } catch (error: unknown) {
      throw this.translateDbError(error)
    }
  }

  /**
   * Transaction içinde güvenli çalıştırır.
   * Hata olursa otomatik rollback yapılır.
   */
  protected safeTransaction<R>(fn: () => R): R {
    try {
      return this.db.transaction(fn)()
    } catch (error: unknown) {
      throw this.translateDbError(error)
    }
  }

  /**
   * SQLite hatalarını anlamlı AppError'a çevirir.
   * Zaten AppError ise olduğu gibi fırlatır (idempotent).
   */
  private translateDbError(error: unknown): AppError {
    // Zaten çevrilmiş hata
    if (error instanceof AppError) return error

    const msg = error instanceof Error ? error.message : String(error)

    // UNIQUE constraint -> 409 Conflict
    if (msg.includes('UNIQUE constraint failed')) {
      const match = msg.match(/UNIQUE constraint failed: \w+\.(\w+)/)
      const field = match?.[1] ?? 'alan'
      return AppError.conflict(`Bu ${field} değeri zaten kullanılıyor`)
    }

    // FOREIGN KEY constraint -> 400 Bad Request
    if (msg.includes('FOREIGN KEY constraint failed')) {
      return AppError.badRequest('İlişkili kayıt bulunamadı')
    }

    // SQLITE_BUSY / database locked -> 503 Service Unavailable
    if (msg.includes('SQLITE_BUSY') || msg.includes('database is locked')) {
      return AppError.busy('Veritabanı meşgul, lütfen tekrar deneyin')
    }

    // NOT NULL constraint -> 400
    if (msg.includes('NOT NULL constraint failed')) {
      const match = msg.match(/NOT NULL constraint failed: \w+\.(\w+)/)
      const field = match?.[1] ?? 'alan'
      return AppError.badRequest(`${field} alanı boş bırakılamaz`)
    }

    // CHECK constraint -> 400
    if (msg.includes('CHECK constraint failed')) {
      return AppError.badRequest('Geçersiz veri girişi')
    }

    // Bilinmeyen DB hatası -> 500
    this.logger.error(
      `DB hatası: ${msg}`,
      error instanceof Error ? error : undefined,
      this.getTableName()
    )
    return AppError.internal(`Veritabanı hatası: ${msg}`)
  }

  // ================================================================
  // STANDART CRUD - Alt sınıflarda tekrar yazılmaz
  // ================================================================

  /** Tüm kayıtları getirir (yeniden eskiye) */
  findAll(): T[] {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(`SELECT * FROM ${this.getTableName()} ORDER BY id DESC`)
      return this.toAppModels(stmt.all() as Record<string, unknown>[])
    })
  }

  /** ID ile tek kayıt getirir */
  findById(id: number): T | null {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(`SELECT * FROM ${this.getTableName()} WHERE id = ?`)
      const row = stmt.get(id) as Record<string, unknown> | undefined
      return row ? this.toAppModel(row) : null
    })
  }

  /** Belirli bir kolona göre birden fazla kayıt getirir */
  findBy(column: string, value: string | number | boolean): T[] {
    return this.safeExecute(() => {
      const dbValue = typeof value === 'boolean' ? (value ? 1 : 0) : value
      const stmt = this.db.prepare(`SELECT * FROM ${this.getTableName()} WHERE ${column} = ?`)
      return this.toAppModels(stmt.all(dbValue) as Record<string, unknown>[])
    })
  }

  /** Belirli bir kolona göre tek kayıt getirir */
  findOneBy(column: string, value: string | number | boolean): T | null {
    return this.safeExecute(() => {
      const dbValue = typeof value === 'boolean' ? (value ? 1 : 0) : value
      const stmt = this.db.prepare(
        `SELECT * FROM ${this.getTableName()} WHERE ${column} = ? LIMIT 1`
      )
      const row = stmt.get(dbValue) as Record<string, unknown> | undefined
      return row ? this.toAppModel(row) : null
    })
  }

  /** Yeni kayıt oluşturur. Boolean alanlar otomatik 0/1'e çevrilir. */
  create(data: Record<string, unknown>): T {
    return this.safeExecute(() => {
      const dbData = this.toDbModel(data)
      const keys = Object.keys(dbData)
      const values = Object.values(dbData)
      const placeholders = keys.map(() => '?').join(', ')

      const stmt = this.db.prepare(
        `INSERT INTO ${this.getTableName()} (${keys.join(', ')}) VALUES (${placeholders})`
      )
      const result = stmt.run(...values)
      return this.findById(result.lastInsertRowid as number) as T
    })
  }

  /** Kaydı günceller. Boolean alanlar otomatik 0/1'e çevrilir. updated_at otomatik eklenir. */
  update(id: number, data: Record<string, unknown>): T | null {
    return this.safeExecute(() => {
      const now = formatForDatabase()
      const dbData = this.toDbModel({ ...data, updated_at: now })
      const keys = Object.keys(dbData)
      const values = Object.values(dbData)
      const setClause = keys.map((key) => `${key} = ?`).join(', ')

      const stmt = this.db.prepare(`UPDATE ${this.getTableName()} SET ${setClause} WHERE id = ?`)
      stmt.run(...values, id)
      return this.findById(id)
    })
  }

  /** Kaydı siler */
  delete(id: number): boolean {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(`DELETE FROM ${this.getTableName()} WHERE id = ?`)
      const result = stmt.run(id)
      return result.changes > 0
    })
  }

  /** Kaydın var olup olmadığını kontrol eder */
  exists(id: number): boolean {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(`SELECT 1 FROM ${this.getTableName()} WHERE id = ? LIMIT 1`)
      return stmt.get(id) !== undefined
    })
  }

  /** Toplam kayıt sayısı */
  count(): number {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(`SELECT COUNT(*) as total FROM ${this.getTableName()}`)
      const result = stmt.get() as { total: number }
      return result.total
    })
  }
}
