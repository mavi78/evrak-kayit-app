// ============================================================
// IncomingDocumentRepository - Gelen evrak veritabanı işlemleri
//
// Sorumlulukları:
// 1. incoming_documents tablosu CRUD
// 2. day_sequence_no otomatik üretim
// 3. Filtreli arama (id, makam, konu, sayı, tarih)
// ============================================================

import { BaseRepository } from '@main/core/BaseRepository'
import type { IncomingDocument } from '@shared/types'
import { normalizeForSearch } from '@shared/utils/searchUtils'
import { parseSearchDateToDisplayFormat } from '@shared/utils/documentDateUtils'

const TABLE_NAME = 'incoming_documents'

const SCHEMA = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  /** Sonraki kayıt numarası — id (AUTOINCREMENT) tabanlı */
  getNextId(): number {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(
        `SELECT COALESCE(MAX(id), 0) + 1 AS next_no FROM ${this.getTableName()}`
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
        `SELECT COALESCE(MAX(day_sequence_no), 0) + 1 AS next_no FROM ${this.getTableName()} WHERE DATE(created_at) = ?`
      )
      const row = stmt.get(recordDate) as { next_no: number } | undefined
      return row?.next_no ?? 1
    })
  }

  /**
   * Atomik kayıt oluşturma — day_sequence_no ve INSERT tek transaction'da.
   * Birden fazla PC aynı anda kayıt oluşturduğunda race condition önlenir.
   * Kayıt numarası (K.No) olarak SQLite AUTOINCREMENT id kullanılır.
   */
  createWithAutoNumbers(
    todayDate: string,
    data: Omit<Record<string, unknown>, 'day_sequence_no' | 'record_date'>
  ): IncomingDocument {
    return this.safeTransaction(() => {
      // Transaction içinde atomik gün sıra numarası üretimi
      const daySeqStmt = this.db.prepare(
        `SELECT COALESCE(MAX(day_sequence_no), 0) + 1 AS next_no FROM ${this.getTableName()} WHERE DATE(created_at) = ?`
      )
      const daySequenceNo =
        (daySeqStmt.get(todayDate) as { next_no: number } | undefined)?.next_no ?? 1

      const fullData = this.toDbModel({
        ...data,
        record_date: todayDate,
        day_sequence_no: daySequenceNo
      })
      const keys = Object.keys(fullData)
      const values = Object.values(fullData)
      const placeholders = keys.map(() => '?').join(', ')

      const insertStmt = this.db.prepare(
        `INSERT INTO ${this.getTableName()} (${keys.join(', ')}) VALUES (${placeholders})`
      )
      const result = insertStmt.run(...values)
      return this.findById(result.lastInsertRowid as number) as IncomingDocument
    })
  }

  /**
   * K.No (id) ve/veya genel metin ile arama (sayfalanmış).
   * Kayıt tarihi (record_date) dahil değildir.
   * @param filters - id, query
   * @param page - Sayfa numarası (1 tabanlı)
   * @param pageSize - Sayfa boyutu (min 20)
   * @returns { data, total }
   */
  searchByQueryPaginated(
    filters: { id?: number; query?: string },
    page: number,
    pageSize: number
  ): { data: IncomingDocument[]; total: number } {
    return this.safeExecute(() => {
      const limit = Math.max(20, Math.min(500, pageSize))
      const offset = Math.max(0, (Math.max(1, page) - 1) * limit)

      const { id, query } = filters
      const q = (query ?? '').trim()
      const hasId = id != null && !Number.isNaN(id)
      const hasQuery = q.length > 0

      const conditions: string[] = []
      const params: (string | number)[] = []

      if (hasId) {
        conditions.push('id = ?')
        params.push(id!)
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
        `SELECT COUNT(*) AS total FROM ${this.getTableName()} ${whereClause}`
      )
      const { total } = countStmt.get(...params) as { total: number }

      const dataStmt = this.db.prepare(
        `SELECT * FROM ${this.getTableName()} ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`
      )
      const rows = dataStmt.all(...params, limit, offset) as Record<string, unknown>[]
      return {
        data: this.toAppModels(rows),
        total
      }
    })
  }
}
