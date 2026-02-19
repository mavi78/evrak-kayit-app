// ============================================================
// AuthRepository - Kullanıcı ve izin veritabanı işlemleri
// BaseRepository'den türetilir. Kendi tablolarını oluşturur.
// Tüm sorgular safeExecute ile korunur.
// ============================================================

import { BaseRepository } from '@main/core/BaseRepository'
import type { User, UserWithoutPassword, PagePermission, UserRole } from '@shared/types'

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
      )`,
      `CREATE TABLE IF NOT EXISTS role_page_defaults (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL CHECK(role IN ('superadmin', 'admin', 'user')),
        page_key TEXT NOT NULL,
        set_by INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (set_by) REFERENCES users(id),
        UNIQUE(role, page_key)
      )`,
      `CREATE TABLE IF NOT EXISTS role_visibility_defaults (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_role TEXT NOT NULL CHECK(target_role IN ('superadmin', 'admin', 'user')),
        page_key TEXT NOT NULL,
        can_access INTEGER NOT NULL DEFAULT 1 CHECK(can_access IN (0, 1)),
        granted_by INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (granted_by) REFERENCES users(id),
        UNIQUE(target_role, page_key)
      )`,
      `CREATE TABLE IF NOT EXISTS role_page_access (
        role TEXT NOT NULL CHECK(role IN ('superadmin', 'admin', 'user')),
        page_key TEXT NOT NULL,
        can_access INTEGER NOT NULL DEFAULT 1 CHECK(can_access IN (0, 1)),
        granted_by INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        PRIMARY KEY (role, page_key),
        FOREIGN KEY (granted_by) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS role_system_defaults (
        role TEXT NOT NULL CHECK(role IN ('superadmin', 'admin', 'user')),
        page_key TEXT NOT NULL,
        can_access INTEGER NOT NULL DEFAULT 1 CHECK(can_access IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        PRIMARY KEY (role, page_key)
      )`
    ]
  }

  constructor() {
    super()
    this.migrateUsersTableIfNeeded()
    this.migrateUsersRoleToIncludeSystem()
    this.migrateUsersAddMustChangePassword()
    this.ensureRolePageDefaultsTable()
    this.ensureRoleVisibilityDefaultsTable()
    this.ensureRolePageAccessTableAndMigrate()
    this.ensureRoleSystemDefaultsTableAndSeed()
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
      this.logger.info(
        'users tablosu yeni şemaya geçirildi (tc_kimlik_no, rutbe)',
        'AuthRepository'
      )
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
      this.db
        .prepare(
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
        )
        .run()
      this.db.prepare('INSERT INTO users_new SELECT * FROM users').run()
      this.db.prepare('DROP TABLE users').run()
      this.db.prepare('ALTER TABLE users_new RENAME TO users').run()
      this.db.prepare('PRAGMA foreign_keys = ON').run()
      this.logger.info("users tablosu role CHECK'e 'system' eklendi", 'AuthRepository')
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
      this.db
        .prepare('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0')
        .run()
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
  // ROL SAYFA ERİŞİMİ (role_page_access — tek kaynak)
  // ================================================================

  /** Belirtilen rol için sayfa erişim listesini getirir (page_key, can_access). */
  getRolePageAccess(
    role: Exclude<UserRole, 'system'>
  ): { page_key: string; can_access: boolean }[] {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(
        `SELECT page_key, can_access FROM role_page_access WHERE role = ? ORDER BY page_key`
      )
      const rows = stmt.all(role) as { page_key: string; can_access: number }[]
      return rows.map((r) => ({ page_key: r.page_key, can_access: r.can_access === 1 }))
    })
  }

  /** Belirtilen rol için sayfa erişim listesini günceller (önce siler, sonra ekler). */
  setRolePageAccess(
    role: Exclude<UserRole, 'system'>,
    defaults: { page_key: string; can_access: boolean }[],
    grantedBy: number | null
  ): void {
    this.safeExecute(() => {
      this.db.prepare(`DELETE FROM role_page_access WHERE role = ?`).run(role)
      const insert = this.db.prepare(
        `INSERT INTO role_page_access (role, page_key, can_access, granted_by) VALUES (?, ?, ?, ?)`
      )
      for (const d of defaults) {
        insert.run(role, d.page_key, d.can_access ? 1 : 0, grantedBy)
      }
    })
  }

  /** Eski tablolardan role_page_access'e veri taşır; tablo yoksa oluşturur. */
  private ensureRolePageAccessTableAndMigrate(): void {
    this.safeExecute(() => {
      const tables = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='role_page_access'")
        .all() as { name: string }[]
      if (tables.length > 0) return

      this.db.exec(
        `CREATE TABLE IF NOT EXISTS role_page_access (
          role TEXT NOT NULL CHECK(role IN ('superadmin', 'admin', 'user')),
          page_key TEXT NOT NULL,
          can_access INTEGER NOT NULL DEFAULT 1 CHECK(can_access IN (0, 1)),
          granted_by INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          PRIMARY KEY (role, page_key),
          FOREIGN KEY (granted_by) REFERENCES users(id)
        )`
      )

      const rpd = this.db
        .prepare(`SELECT role, page_key, set_by FROM role_page_defaults`)
        .all() as {
        role: string
        page_key: string
        set_by: number | null
      }[]
      const rvd = this.db
        .prepare(
          `SELECT target_role AS role, page_key, can_access, granted_by FROM role_visibility_defaults`
        )
        .all() as { role: string; page_key: string; can_access: number; granted_by: number }[]
      const byRole = new Map<
        string,
        Map<string, { can_access: number; granted_by: number | null }>
      >()
      for (const r of rpd) {
        if (!byRole.has(r.role)) byRole.set(r.role, new Map())
        byRole.get(r.role)!.set(r.page_key, { can_access: 1, granted_by: r.set_by ?? null })
      }
      for (const r of rvd) {
        if (!byRole.has(r.role)) byRole.set(r.role, new Map())
        byRole.get(r.role)!.set(r.page_key, { can_access: r.can_access, granted_by: r.granted_by })
      }
      const insert = this.db.prepare(
        `INSERT INTO role_page_access (role, page_key, can_access, granted_by) VALUES (?, ?, ?, ?)`
      )
      for (const [role, map] of byRole) {
        for (const [page_key, v] of map) {
          insert.run(role, page_key, v.can_access, v.granted_by)
        }
      }
      this.logger.info('role_page_access tablosu oluşturuldu ve veri taşındı', 'AuthRepository')
    })
  }

  // ================================================================
  // SYSTEM DEFAULT SAYFA ERİŞİMİ (role_system_defaults — sadece system yazar)
  // ================================================================

  /** System'ın belirli bir role verdiği sayfa erişim listesini getirir. */
  getRoleSystemDefaults(
    role: Exclude<UserRole, 'system'>
  ): { page_key: string; can_access: boolean }[] {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(
        `SELECT page_key, can_access FROM role_system_defaults WHERE role = ? ORDER BY page_key`
      )
      const rows = stmt.all(role) as { page_key: string; can_access: number }[]
      return rows.map((r) => ({ page_key: r.page_key, can_access: r.can_access === 1 }))
    })
  }

  /** System'ın belirli bir role verdiği sayfa erişim listesini günceller (sadece system çağırır). */
  setRoleSystemDefaults(
    role: Exclude<UserRole, 'system'>,
    defaults: { page_key: string; can_access: boolean }[]
  ): void {
    this.safeExecute(() => {
      this.db.prepare(`DELETE FROM role_system_defaults WHERE role = ?`).run(role)
      const insert = this.db.prepare(
        `INSERT INTO role_system_defaults (role, page_key, can_access) VALUES (?, ?, ?)`
      )
      for (const d of defaults) {
        insert.run(role, d.page_key, d.can_access ? 1 : 0)
      }
    })
  }

  /**
   * Rol için efektif sayfa erişimi: önce role_system_defaults, üzerine role_page_access (override) uygulanır.
   * Listeleme ve hasPageAccess bu sonucu kullanır.
   */
  getEffectiveRolePageAccess(
    role: Exclude<UserRole, 'system'>
  ): { page_key: string; can_access: boolean }[] {
    const systemDefaults = this.getRoleSystemDefaults(role)
    const overrides = this.getRolePageAccess(role)
    const byPage = new Map<string, boolean>()
    for (const r of systemDefaults) {
      byPage.set(r.page_key, r.can_access)
    }
    for (const r of overrides) {
      byPage.set(r.page_key, r.can_access)
    }
    return Array.from(byPage.entries())
      .map(([page_key, can_access]) => ({ page_key, can_access }))
      .sort((a, b) => a.page_key.localeCompare(b.page_key))
  }

  /** role_system_defaults tablosu yoksa oluşturur ve boşsa seed doldurur. */
  private ensureRoleSystemDefaultsTableAndSeed(): void {
    this.safeExecute(() => {
      const tables = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='role_system_defaults'"
        )
        .all() as { name: string }[]
      if (tables.length === 0) {
        this.db.exec(
          `CREATE TABLE IF NOT EXISTS role_system_defaults (
            role TEXT NOT NULL CHECK(role IN ('superadmin', 'admin', 'user')),
            page_key TEXT NOT NULL,
            can_access INTEGER NOT NULL DEFAULT 1 CHECK(can_access IN (0, 1)),
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            PRIMARY KEY (role, page_key)
          )`
        )
        this.logger.info('role_system_defaults tablosu oluşturuldu', 'AuthRepository')
      }
      const count = (
        this.db.prepare(`SELECT COUNT(*) as c FROM role_system_defaults`).get() as { c: number }
      ).c
      if (count === 0) {
        const insert = this.db.prepare(
          `INSERT INTO role_system_defaults (role, page_key, can_access) VALUES (?, ?, ?)`
        )
        const pages = [
          'user-management',
          'page-management',
          'courier-delivered',
          'courier-not-delivered'
        ]
        for (const p of pages) {
          insert.run('superadmin', p, 1)
        }
        insert.run('admin', 'user-management', 1)
        insert.run('admin', 'courier-delivered', 1)
        insert.run('admin', 'courier-not-delivered', 1)
        insert.run('user', 'courier-delivered', 1)
        insert.run('user', 'courier-not-delivered', 1)
        this.logger.info('role_system_defaults seed verisi eklendi', 'AuthRepository')
      }
    })
  }

  // ================================================================
  // ROL SAYFA VARSAYILANLARI (system default — role_system_defaults)
  // Not: Eski proxy metotlar (getRolePageDefaults, setRolePageDefaults,
  // getRoleVisibilityDefaults, setRoleVisibilityDefaults) kaldırıldı.
  // Service katmanı doğrudan getRoleSystemDefaults, setRoleSystemDefaults,
  // getEffectiveRolePageAccess, setRolePageAccess çağırır.
  // ================================================================

  /** role_page_defaults tablosu yoksa oluşturur (migration). */
  private ensureRolePageDefaultsTable(): void {
    this.safeExecute(() => {
      const tables = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='role_page_defaults'")
        .all() as { name: string }[]
      if (tables.length > 0) return
      this.db.exec(
        `CREATE TABLE IF NOT EXISTS role_page_defaults (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role TEXT NOT NULL CHECK(role IN ('superadmin', 'admin', 'user')),
          page_key TEXT NOT NULL,
          set_by INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (set_by) REFERENCES users(id),
          UNIQUE(role, page_key)
        )`
      )
      this.logger.info('role_page_defaults tablosu oluşturuldu', 'AuthRepository')
    })
  }

  // ================================================================
  // ROL VARSAYILAN GÖRÜNÜRLÜK (efektif: system default + override)
  // Not: Eski proxy metotlar kaldırıldı (yukarıdaki nota bakın).
  // Service doğrudan getEffectiveRolePageAccess / setRolePageAccess çağırır.
  // ================================================================

  /** role_visibility_defaults tablosu yoksa oluşturur (migration). */
  private ensureRoleVisibilityDefaultsTable(): void {
    this.safeExecute(() => {
      const tables = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='role_visibility_defaults'"
        )
        .all() as { name: string }[]
      if (tables.length > 0) return
      this.db.exec(
        `CREATE TABLE IF NOT EXISTS role_visibility_defaults (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          target_role TEXT NOT NULL CHECK(target_role IN ('superadmin', 'admin', 'user')),
          page_key TEXT NOT NULL,
          can_access INTEGER NOT NULL DEFAULT 1 CHECK(can_access IN (0, 1)),
          granted_by INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (granted_by) REFERENCES users(id),
          UNIQUE(target_role, page_key)
        )`
      )
      this.logger.info('role_visibility_defaults tablosu oluşturuldu', 'AuthRepository')
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
