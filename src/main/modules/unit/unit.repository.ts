// ============================================================
// UnitRepository - Birlik veritabanı işlemleri
//
// Sorumlulukları:
// 1. units tablosu CRUD
// 2. Hiyerarşik liste (parent_id NULL = üst birlik)
// ============================================================

import { BaseRepository } from '@main/core/BaseRepository'
import type { Unit } from '@shared/types'

export class UnitRepository extends BaseRepository<Unit> {
  protected getTableName(): string {
    return 'units'
  }

  protected override getBooleanColumns(): readonly string[] {
    return ['is_active']
  }

  protected getTableSchemas(): readonly string[] {
    return [
      `CREATE TABLE IF NOT EXISTS units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        short_name TEXT NOT NULL,
        parent_id INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (parent_id) REFERENCES units(id) ON DELETE SET NULL
      )`
    ]
  }

  constructor() {
    super()
    this.migrateSortOrder()
  }

  /** Migration: sort_order kolonu ekle (eğer yoksa) */
  private migrateSortOrder(): void {
    this.safeExecute(() => {
      // Kolonun var olup olmadığını kontrol et
      const columns = this.db.prepare('PRAGMA table_info(units)').all() as Array<{
        name: string
        type: string
      }>
      const hasSortOrder = columns.some((col) => col.name === 'sort_order')

      if (!hasSortOrder) {
        try {
          this.db.exec('ALTER TABLE units ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0')
          this.logger.debug('sort_order kolonu eklendi', 'UnitRepository')
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          this.logger.warn(`sort_order migration hatası: ${errorMessage}`, 'UnitRepository')
        }
      }
    })
  }

  /** Sıralı liste: önce üst birimler (parent_id NULL), sonra alt birimler, sort_order ve isim sırasına göre */
  findAllOrdered(): Unit[] {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(
        `SELECT * FROM ${this.getTableName()} ORDER BY parent_id IS NULL DESC, parent_id ASC, sort_order ASC, name ASC, id ASC`
      )
      return this.toAppModels(stmt.all() as Record<string, unknown>[])
    })
  }

  /** Bir birimin alt birimlerini recursive olarak bulur */
  findDescendants(id: number): number[] {
    return this.safeExecute(() => {
      const descendants: number[] = []
      const queue = [id]
      while (queue.length > 0) {
        const currentId = queue.shift()!
        const children = this.db
          .prepare(`SELECT id FROM ${this.getTableName()} WHERE parent_id = ?`)
          .all(currentId) as Array<{ id: number }>
        for (const child of children) {
          descendants.push(child.id)
          queue.push(child.id)
        }
      }
      return descendants
    })
  }

  /** Hiyerarşi güncelleme: bir birimi ve alt birimlerini taşır */
  updateHierarchy(id: number, parentId: number | null, sortOrder?: number): Unit | null {
    return this.safeExecute(() => {
      if (parentId != null) {
        const descendants = this.findDescendants(id)
        if (descendants.includes(parentId)) {
          throw new Error('Bir birlik kendi alt biriminin altına taşınamaz')
        }
      }
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
      if (sortOrder !== undefined) {
        this.db
          .prepare(
            `UPDATE ${this.getTableName()} SET parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ?`
          )
          .run(parentId, sortOrder, now, id)
      } else {
        this.db
          .prepare(`UPDATE ${this.getTableName()} SET parent_id = ?, updated_at = ? WHERE id = ?`)
          .run(parentId, now, id)
      }
      return this.findById(id)
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
