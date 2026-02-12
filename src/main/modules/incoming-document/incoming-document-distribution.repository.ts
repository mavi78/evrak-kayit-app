// ============================================================
// IncomingDocumentDistributionRepository - Havale/dağıtım kayıtları
//
// Sorumlulukları:
// 1. incoming_document_distributions tablosu CRUD
// 2. incoming_document_id ile listeleme
// ============================================================

import { BaseRepository } from '@main/core/BaseRepository'
import type { IncomingDocumentDistribution } from '@shared/types'

const TABLE_NAME = 'incoming_document_distributions'

const SCHEMA = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incoming_document_id INTEGER NOT NULL,
  unit_id INTEGER NOT NULL,
  distribution_type TEXT NOT NULL DEFAULT '',
  delivery_date TEXT NOT NULL DEFAULT '',
  receipt_no TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (incoming_document_id) REFERENCES incoming_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id) REFERENCES units(id)
)`

export class IncomingDocumentDistributionRepository extends BaseRepository<IncomingDocumentDistribution> {
  protected getTableName(): string {
    return TABLE_NAME
  }

  protected getTableSchemas(): readonly string[] {
    return [SCHEMA]
  }

  /** Bir gelen evraka ait tüm havale/dağıtım kayıtları */
  findByIncomingDocumentId(incomingDocumentId: number): IncomingDocumentDistribution[] {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(
        `SELECT * FROM ${TABLE_NAME} WHERE incoming_document_id = ? ORDER BY id ASC`
      )
      return this.toAppModels(stmt.all(incomingDocumentId) as Record<string, unknown>[])
    })
  }
}
