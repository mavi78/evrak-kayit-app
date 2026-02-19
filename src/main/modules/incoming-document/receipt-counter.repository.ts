// ============================================================
// ReceiptCounterRepository - Senet numarası sayacı
//
// Sorumlulukları:
// 1. receipt_counter tablosu (tek satır, id=1)
// 2. Atomik senet no üretimi (exclusive transaction)
// ============================================================

import { BaseRepository } from '@main/core/BaseRepository'

interface ReceiptCounter {
  id: number
  last_receipt_no: number
  created_at: string
  updated_at: string
}

const TABLE_NAME = 'receipt_counter'

const SCHEMA = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  last_receipt_no INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
)`

const SEED = `INSERT OR IGNORE INTO ${TABLE_NAME} (id, last_receipt_no) VALUES (1, 0)`

export class ReceiptCounterRepository extends BaseRepository<ReceiptCounter> {
  constructor() {
    super()
    // Seed'i ayrı çalıştır — initializeTables transaction'ını bekledikten sonra
    this.safeExecute(() => {
      this.db.exec(SEED)
    })
  }

  protected getTableName(): string {
    return TABLE_NAME
  }

  protected getTableSchemas(): readonly string[] {
    return [SCHEMA]
  }

  /**
   * Atomik senet no üretimi.
   * EXCLUSIVE transaction ile sayacı okur, +1 artırır, günceller ve yeni değeri döner.
   * Eşzamanlı çağrılarda çakışma imkansızdır.
   */
  getNextReceiptNo(): number {
    return this.safeTransaction(() => {
      const row = this.db
        .prepare(`SELECT last_receipt_no FROM ${TABLE_NAME} WHERE id = 1`)
        .get() as { last_receipt_no: number } | undefined

      const current = row?.last_receipt_no ?? 0
      const next = current + 1

      this.db
        .prepare(
          `UPDATE ${TABLE_NAME} SET last_receipt_no = ?, updated_at = datetime('now', 'localtime') WHERE id = 1`
        )
        .run(next)

      return next
    })
  }
}
