// ============================================================
// DistributionRepository - Dağıtım kayıtları (3 sayfa ortak)
//
// Sorumlulukları:
// 1. document_distributions tablosu CRUD
// 2. document_id + document_scope ile listeleme
// 3. Teslim işlemi (is_delivered, delivery_date, receipt_no)
// ============================================================

import { BaseRepository } from '@main/core/BaseRepository'
import type { DocumentDistribution } from '@shared/types'

const TABLE_NAME = 'document_distributions'

const SCHEMA = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  document_scope TEXT NOT NULL CHECK(document_scope IN ('INCOMING','OUTGOING','TRANSIT')),
  unit_id INTEGER NOT NULL,
  parent_unit_id INTEGER,
  channel_id INTEGER NOT NULL,
  is_delivered INTEGER NOT NULL DEFAULT 0 CHECK(is_delivered IN (0, 1)),
  delivery_date TEXT,
  receipt_no INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (parent_unit_id) REFERENCES units(id),
  FOREIGN KEY (channel_id) REFERENCES channels(id)
)`

export class DistributionRepository extends BaseRepository<DocumentDistribution> {
  protected getTableName(): string {
    return TABLE_NAME
  }

  protected override getBooleanColumns(): readonly string[] {
    return ['is_delivered']
  }

  protected getTableSchemas(): readonly string[] {
    return [SCHEMA]
  }

  /** Bir evraka ait tüm dağıtım kayıtları (scope bazlı) */
  findByDocumentAndScope(documentId: number, scope: string): DocumentDistribution[] {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(
        `SELECT * FROM ${TABLE_NAME} WHERE document_id = ? AND document_scope = ? ORDER BY id ASC`
      )
      return this.toAppModels(stmt.all(documentId, scope) as Record<string, unknown>[])
    })
  }

  /** Teslim işareti — senet no ve delivery_date ile güncelleme */
  markDelivered(id: number, receiptNo: number): DocumentDistribution | null {
    return this.safeExecute(() => {
      const now = new Date()
      const deliveryDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      const stmt = this.db.prepare(
        `UPDATE ${TABLE_NAME} SET is_delivered = 1, delivery_date = ?, receipt_no = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      stmt.run(deliveryDate, receiptNo, id)
      return this.findById(id)
    })
  }

  /** Teslim işareti — senet no olmadan (receipt_no = null), sadece delivery_date ile */
  markDeliveredWithoutReceipt(id: number): DocumentDistribution | null {
    return this.safeExecute(() => {
      const now = new Date()
      const deliveryDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      const stmt = this.db.prepare(
        `UPDATE ${TABLE_NAME} SET is_delivered = 1, delivery_date = ?, receipt_no = NULL, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      stmt.run(deliveryDate, id)
      return this.findById(id)
    })
  }
}
