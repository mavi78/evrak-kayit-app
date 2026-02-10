// ============================================================
// ChannelRepository - Kanal veritabanı işlemleri
//
// Sorumlulukları:
// 1. channels tablosu CRUD
// 2. Sıralı liste (sort_order, id)
// ============================================================

import { BaseRepository } from '@main/core/BaseRepository'
import type { Channel } from '@shared/types'

export class ChannelRepository extends BaseRepository<Channel> {
  protected getTableName(): string {
    return 'channels'
  }

  protected override getBooleanColumns(): readonly string[] {
    return ['is_default', 'is_active']
  }

  protected getTableSchemas(): readonly string[] {
    return [
      `CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0, 1)),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      )`
    ]
  }

  findAllOrdered(): Channel[] {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(
        `SELECT * FROM ${this.getTableName()} ORDER BY sort_order ASC, id ASC`
      )
      return this.toAppModels(stmt.all() as Record<string, unknown>[])
    })
  }

  clearDefaultExcept(excludeId: number | null): void {
    this.safeExecute(() => {
      const table = this.getTableName()
      if (excludeId != null) {
        this.db.prepare(`UPDATE ${table} SET is_default = 0 WHERE id != ?`).run(excludeId)
      } else {
        this.db.prepare(`UPDATE ${table} SET is_default = 0`).run()
      }
    })
  }

  /** Batch sort order güncelleme */
  batchUpdateSortOrder(items: Array<{ id: number; sort_order: number }>): void {
    this.safeTransaction(() => {
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
      const stmt = this.db.prepare(
        `UPDATE ${this.getTableName()} SET sort_order = ?, updated_at = ? WHERE id = ?`
      )
      for (const item of items) {
        stmt.run(item.sort_order, now, item.id)
      }
    })
  }
}
