// ============================================================
// IncomingDocumentRepository - Gelen evrak veritabanı işlemleri
//
// Sorumlulukları:
// 1. incoming_documents tablosu CRUD
// 2. record_no ve day_sequence_no otomatik üretim
// 3. Filtreli arama (kayıt no, makam, konu, sayı, tarih)
// ============================================================

import { BaseRepository } from '@main/core/BaseRepository'
import type { IncomingDocument } from '@shared/types'
import { normalizeForSearch } from '@shared/utils/searchUtils'
import { parseSearchDateToDisplayFormat } from '@shared/utils/documentDateUtils'

const TABLE_NAME = 'incoming_documents'

const SCHEMA = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_no INTEGER NOT NULL UNIQUE,
  record_date TEXT NOT NULL,
  day_sequence_no INTEGER NOT NULL,
  channel_id INTEGER NOT NULL,
  source_office TEXT NOT NULL DEFAULT '',
  reference_number TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  document_date TEXT NOT NULL DEFAULT '',
  document_type TEXT NOT NULL CHECK(document_type IN ('EVRAK', 'MESAJ')),
  attachment_count INTEGER NOT NULL DEFAULT 0,
  classification_id INTEGER NOT NULL,
  security_control_no TEXT NOT NULL DEFAULT '',
  page_count INTEGER NOT NULL DEFAULT 0,
  category_id INTEGER NOT NULL,
  folder_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (channel_id) REFERENCES channels(id),
  FOREIGN KEY (classification_id) REFERENCES classifications(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (folder_id) REFERENCES folders(id)
)`

export class IncomingDocumentRepository extends BaseRepository<IncomingDocument> {
  protected getTableName(): string {
    return TABLE_NAME
  }

  protected getTableSchemas(): readonly string[] {
    return [SCHEMA]
  }

  /** Sonraki kayıt numarası (mevcut max + 1) */
  getNextRecordNo(): number {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(
        `SELECT COALESCE(MAX(record_no), 0) + 1 AS next_no FROM ${TABLE_NAME}`
      )
      const row = stmt.get() as { next_no: number }
      return row.next_no
    })
  }

  /** Verilen kayıt tarihindeki o güne ait sonraki gün sıra numarası (created_at'e göre) */
  getNextDaySequenceNo(recordDate: string): number {
    return this.safeExecute(() => {
      // created_at'in tarih kısmı (DATE(created_at)) ile karşılaştır
      const stmt = this.db.prepare(
        `SELECT COALESCE(MAX(day_sequence_no), 0) + 1 AS next_no FROM ${TABLE_NAME} WHERE DATE(created_at) = ?`
      )
      const row = stmt.get(recordDate) as { next_no: number } | undefined
      return row?.next_no ?? 1
    })
  }

  /**
   * K.No ve/veya genel metin ile arama (sayfalanmış).
   * Kayıt tarihi (record_date) dahil değildir.
   * @param filters - recordNo, query
   * @param page - Sayfa numarası (1 tabanlı)
   * @param pageSize - Sayfa boyutu (min 20)
   * @returns { data, total }
   */
  searchByQueryPaginated(
    filters: { recordNo?: number; query?: string },
    page: number,
    pageSize: number
  ): { data: IncomingDocument[]; total: number } {
    return this.safeExecute(() => {
      const limit = Math.max(20, Math.min(500, pageSize))
      const offset = Math.max(0, (Math.max(1, page) - 1) * limit)

      const { recordNo, query } = filters
      const q = (query ?? '').trim()
      const hasRecordNo = recordNo != null && !Number.isNaN(recordNo)
      const hasQuery = q.length > 0

      const conditions: string[] = []
      const params: (string | number)[] = []

      if (hasRecordNo) {
        conditions.push('record_no = ?')
        params.push(recordNo!)
      }

      if (hasQuery) {
        const normalized = normalizeForSearch(q)
        const term = `%${normalized}%`
        const displayDate = parseSearchDateToDisplayFormat(q)
        const dateCond = displayDate ? ' OR document_date = ?' : ''
        conditions.push(
          `(toLowerCaseTr(source_office) LIKE ? OR toLowerCaseTr(reference_number) LIKE ?` +
            ` OR toLowerCaseTr(subject) LIKE ? OR toLowerCaseTr(document_date) LIKE ?` +
            ` OR toLowerCaseTr(security_control_no) LIKE ?` +
            ` OR toLowerCaseTr(CAST(day_sequence_no AS TEXT)) LIKE ?${dateCond})`
        )
        params.push(term, term, term, term, term, term)
        if (displayDate) params.push(displayDate)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const countStmt = this.db.prepare(
        `SELECT COUNT(*) AS total FROM ${TABLE_NAME} ${whereClause}`
      )
      const { total } = countStmt.get(...params) as { total: number }

      const dataStmt = this.db.prepare(
        `SELECT * FROM ${TABLE_NAME} ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`
      )
      const rows = dataStmt.all(...params, limit, offset) as Record<string, unknown>[]
      return {
        data: this.toAppModels(rows),
        total
      }
    })
  }
}
