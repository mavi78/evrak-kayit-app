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
    return ['is_active']
  }

  /** Bu modülün tablolarını tanımlar - BaseRepository otomatik oluşturur */
  protected getTableSchemas(): readonly string[] {
    return [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('superadmin', 'admin', 'user')),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
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

  // ================================================================
  // KULLANICI SORGULARI
  // ================================================================

  /** Kullanıcı adıyla arama */
  findByUsername(username: string): User | null {
    return this.findOneBy('username', username)
  }

  /** Şifre hariç tüm kullanıcıları getir */
  findAllWithoutPassword(): UserWithoutPassword[] {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(
        `SELECT id, username, full_name, role, is_active, created_at, updated_at
         FROM ${this.getTableName()} ORDER BY id DESC`
      )
      const rows = stmt.all() as Record<string, unknown>[]
      // is_active boolean dönüşümü uygula
      return rows.map((row) => this.toAppModel(row)) as unknown as UserWithoutPassword[]
    })
  }

  /** Kullanıcı adı alınmış mı? */
  isUsernameTaken(username: string, excludeId?: number): boolean {
    return this.safeExecute(() => {
      if (excludeId) {
        const stmt = this.db.prepare(
          `SELECT COUNT(*) as total FROM ${this.getTableName()} WHERE username = ? AND id != ?`
        )
        return (stmt.get(username, excludeId) as { total: number }).total > 0
      }
      const stmt = this.db.prepare(
        `SELECT COUNT(*) as total FROM ${this.getTableName()} WHERE username = ?`
      )
      return (stmt.get(username) as { total: number }).total > 0
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
