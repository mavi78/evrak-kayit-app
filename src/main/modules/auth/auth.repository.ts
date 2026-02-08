// ============================================================
// AuthRepository - Kullanıcı ve izin veritabanı işlemleri
// BaseRepository'den türetilir. Kendi tablolarını oluşturur.
// Tüm sorgular safeExecute ile korunur.
// ============================================================

import { BaseRepository } from '@main/core/BaseRepository'
import type { User, UserWithoutPassword, PagePermission } from '@shared/types'

export class AuthRepository extends BaseRepository<User> {
  /** page_permissions tablosundaki boolean kolonlar */
  private readonly permissionBoolCols = ['can_access'] as const

  protected getTableName(): string {
    return 'users'
  }

  protected override getBooleanColumns(): readonly string[] {
    return ['is_active', 'must_change_password']
  }

  /** Bu modülün tablolarını tanımlar - BaseRepository otomatik oluşturur */
  protected getTableSchemas(): readonly string[] {
    return [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tc_kimlik_no TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        rutbe TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('system', 'superadmin', 'admin', 'user')),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
        must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      )`,
      `CREATE TABLE IF NOT EXISTS page_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        page_key TEXT NOT NULL,
        can_access INTEGER NOT NULL DEFAULT 0 CHECK(can_access IN (0, 1)),
        granted_by INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (granted_by) REFERENCES users(id),
        UNIQUE(user_id, page_key)
      )`,
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    ]
  }

  constructor() {
    super()
    this.migrateUsersTableIfNeeded()
    this.migrateUsersRoleToIncludeSystem()
    this.migrateUsersAddMustChangePassword()
  }

  /**
   * Eski şemada (username) users tablosu varsa siler; yeni şema (tc_kimlik_no, rutbe)
   * getTableSchemas ile oluşturulacak. Sadece username kolonu varsa migration gerekir.
   */
  private migrateUsersTableIfNeeded(): void {
    this.safeExecute(() => {
      const tables = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        .all() as { name: string }[]
      if (tables.length === 0) return

      const columns = this.db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
      const hasTcKimlikNo = columns.some((c) => c.name === 'tc_kimlik_no')
      if (hasTcKimlikNo) return

      this.db.prepare('DROP TABLE users').run()
      this.db.exec(this.getTableSchemas()[0])
      this.logger.info('users tablosu yeni şemaya geçirildi (tc_kimlik_no, rutbe)', 'AuthRepository')
    })
  }

  // ================================================================
  // KULLANICI SORGULARI
  // ================================================================

  /** TC Kimlik No ile kullanıcı arama */
  findByTcKimlikNo(tcKimlikNo: string): User | null {
    return this.findOneBy('tc_kimlik_no', tcKimlikNo.trim())
  }

  /** Şifre hariç tüm kullanıcıları getir */
  findAllWithoutPassword(): UserWithoutPassword[] {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(
        `SELECT id, tc_kimlik_no, full_name, rutbe, role, is_active, must_change_password, created_at, updated_at
         FROM ${this.getTableName()} ORDER BY id DESC`
      )
      const rows = stmt.all() as Record<string, unknown>[]
      return rows.map((row) => this.toAppModel(row)) as unknown as UserWithoutPassword[]
    })
  }

  /** TC Kimlik No alınmış mı? */
  isTcKimlikNoTaken(tcKimlikNo: string, excludeId?: number): boolean {
    const value = tcKimlikNo.trim()
    return this.safeExecute(() => {
      if (excludeId) {
        const stmt = this.db.prepare(
          `SELECT COUNT(*) as total FROM ${this.getTableName()} WHERE tc_kimlik_no = ? AND id != ?`
        )
        return (stmt.get(value, excludeId) as { total: number }).total > 0
      }
      const stmt = this.db.prepare(
        `SELECT COUNT(*) as total FROM ${this.getTableName()} WHERE tc_kimlik_no = ?`
      )
      return (stmt.get(value) as { total: number }).total > 0
    })
  }

  /** Superadmin var mı? */
  hasSuperAdmin(): boolean {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(
        `SELECT COUNT(*) as total FROM ${this.getTableName()} WHERE role = 'superadmin'`
      )
      return (stmt.get() as { total: number }).total > 0
    })
  }

  /** Sistem kullanıcısı var mı? (silinemez, kaldırılamaz üst yetkili) */
  hasSystemUser(): boolean {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(
        `SELECT COUNT(*) as total FROM ${this.getTableName()} WHERE role = 'system'`
      )
      return (stmt.get() as { total: number }).total > 0
    })
  }

  /**
   * Mevcut users tablosunda role CHECK'i 'system' içermiyorsa tabloyu yeni şemaya geçirir.
   * SQLite CHECK değiştirilemediği için tablo yeniden oluşturulur.
   */
  private migrateUsersRoleToIncludeSystem(): void {
    this.safeExecute(() => {
      const tables = this.db
        .prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name='users'")
        .get() as { name: string; sql: string } | undefined
      if (!tables?.sql) return
      if (tables.sql.includes("'system'")) return

      this.db.prepare('PRAGMA foreign_keys = OFF').run()
      this.db.prepare(
        `CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tc_kimlik_no TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          full_name TEXT NOT NULL,
          rutbe TEXT NOT NULL DEFAULT '',
          role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('system', 'superadmin', 'admin', 'user')),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        )`
      ).run()
      this.db.prepare('INSERT INTO users_new SELECT * FROM users').run()
      this.db.prepare('DROP TABLE users').run()
      this.db.prepare('ALTER TABLE users_new RENAME TO users').run()
      this.db.prepare('PRAGMA foreign_keys = ON').run()
      this.logger.info(
        "users tablosu role CHECK'e 'system' eklendi",
        'AuthRepository'
      )
    })
  }

  /**
   * users tablosuna must_change_password kolonu yoksa ekler.
   * Başkası şifreyi değiştirdiyse kullanıcı ilk girişte şifre değiştirmek zorunda.
   */
  private migrateUsersAddMustChangePassword(): void {
    this.safeExecute(() => {
      const columns = this.db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
      if (columns.some((c) => c.name === 'must_change_password')) return
      this.db.prepare('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0').run()
      this.logger.info('users tablosuna must_change_password kolonu eklendi', 'AuthRepository')
    })
  }

  // ================================================================
  // İZİN SORGULARI (page_permissions tablosu)
  // ================================================================

  /** Kullanıcının tüm sayfa izinlerini getir */
  getPermissionsByUserId(userId: number): PagePermission[] {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(
        `SELECT * FROM page_permissions WHERE user_id = ? ORDER BY page_key`
      )
      const rows = stmt.all(userId) as Record<string, unknown>[]
      return rows.map((row) => this.toBooleans<PagePermission>(row, this.permissionBoolCols))
    })
  }

  /** Belirli bir sayfa iznini getir */
  getPermission(userId: number, pageKey: string): PagePermission | null {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(
        `SELECT * FROM page_permissions WHERE user_id = ? AND page_key = ? LIMIT 1`
      )
      const row = stmt.get(userId, pageKey) as Record<string, unknown> | undefined
      return row ? this.toBooleans<PagePermission>(row, this.permissionBoolCols) : null
    })
  }

  /** Sayfa izni oluştur veya güncelle (UPSERT) */
  upsertPermission(
    userId: number,
    pageKey: string,
    canAccess: boolean,
    grantedBy: number
  ): PagePermission {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(
        `INSERT INTO page_permissions (user_id, page_key, can_access, granted_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, page_key)
         DO UPDATE SET can_access = excluded.can_access, granted_by = excluded.granted_by`
      )
      stmt.run(userId, pageKey, canAccess ? 1 : 0, grantedBy)
      return this.getPermission(userId, pageKey) as PagePermission
    })
  }

  /** Kullanıcının tüm izinlerini sil */
  deletePermissionsByUserId(userId: number): void {
    this.safeExecute(() => {
      this.db.prepare(`DELETE FROM page_permissions WHERE user_id = ?`).run(userId)
    })
  }

  // ================================================================
  // DENETİM GÜNLÜĞÜ (audit_logs tablosu)
  // ================================================================

  /** Denetim günlüğüne kayıt ekle */
  addAuditLog(userId: number | null, action: string, details: string): void {
    this.safeExecute(() => {
      this.db
        .prepare(`INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`)
        .run(userId, action, details)
    })
  }
}
