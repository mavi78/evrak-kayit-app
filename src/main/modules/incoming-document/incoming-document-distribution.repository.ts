// ============================================================
// DistributionRepository - Dağıtım kayıtları (3 sayfa ortak)
//
// Sorumlulukları:
// 1. document_distributions tablosu CRUD
// 2. document_id + document_scope ile listeleme
// 3. Teslim işlemi (is_delivered, delivery_date, receipt_no)
// ============================================================

import { BaseRepository } from '@main/core/BaseRepository'
import type {
  DocumentDistribution,
  CourierPendingDistribution,
  DeliveredReceiptInfo
} from '@shared/types'

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
  delivered_by_user_id INTEGER,
  delivered_by_name TEXT,
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

  /** Teslim işareti — senet no, delivery_date ve teslim eden kullanıcı ile güncelleme */
  markDelivered(
    id: number,
    receiptNo: number,
    deliveredByUserId: number,
    deliveredByName: string
  ): DocumentDistribution | null {
    return this.safeExecute(() => {
      const now = new Date()
      const deliveryDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      const stmt = this.db.prepare(
        `UPDATE ${TABLE_NAME} SET is_delivered = 1, delivery_date = ?, receipt_no = ?, delivered_by_user_id = ?, delivered_by_name = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      stmt.run(deliveryDate, receiptNo, deliveredByUserId, deliveredByName, id)
      return this.findById(id)
    })
  }

  /** Teslim işareti — senet no olmadan (receipt_no = null), sadece delivery_date ve kullanıcı bilgisi ile */
  markDeliveredWithoutReceipt(
    id: number,
    deliveredByUserId: number,
    deliveredByName: string
  ): DocumentDistribution | null {
    return this.safeExecute(() => {
      const now = new Date()
      const deliveryDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      const stmt = this.db.prepare(
        `UPDATE ${TABLE_NAME} SET is_delivered = 1, delivery_date = ?, receipt_no = NULL, delivered_by_user_id = ?, delivered_by_name = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      stmt.run(deliveryDate, deliveredByUserId, deliveredByName, id)
      return this.findById(id)
    })
  }

  /**
   * Kurye kanalıyla teslim edilmemiş dağıtımlar — evrak detaylarıyla birlikte.
   * Birlik ID listesine göre filtreler: unit_id veya parent_unit_id eşleşmesi.
   */
  findPendingCourierByUnitIds(unitIds: number[]): CourierPendingDistribution[] {
    if (unitIds.length === 0) return []
    return this.safeExecute(() => {
      const placeholders = unitIds.map(() => '?').join(', ')
      const sql = `
        SELECT
          d.id AS distribution_id,
          d.document_id,
          d.document_scope,
          d.unit_id,
          d.parent_unit_id,
          d.channel_id,
          doc.record_date,
          doc.day_sequence_no,
          doc.source_office,
          doc.reference_number,
          doc.subject,
          doc.document_date,
          doc.document_type,
          doc.classification_id,
          doc.security_control_no,
          doc.attachment_count,
          doc.page_count
        FROM ${TABLE_NAME} d
        INNER JOIN incoming_documents doc ON d.document_id = doc.id
        INNER JOIN channels ch ON d.channel_id = ch.id
        WHERE d.is_delivered = 0
          AND d.document_scope = 'INCOMING'
          AND LOWER(ch.name) = 'kurye'
          AND (d.unit_id IN (${placeholders}) OR d.parent_unit_id IN (${placeholders}))
        ORDER BY doc.id DESC
      `
      const params = [...unitIds, ...unitIds]
      const rows = this.db.prepare(sql).all(...params) as CourierPendingDistribution[]
      return rows
    })
  }

  /**
   * Kurye kanalıyla teslim edilmiş dağıtımlar — evrak ve birlik detaylarıyla.
   * CourierDeliveredPage için kullanılır.
   * @param dateFrom Başlangıç tarihi (YYYY-MM-DD)
   * @param dateTo Bitiş tarihi (YYYY-MM-DD)
   * @param unitIds Opsiyonel birlik ID filtresi
   */
  findDeliveredCourier(
    dateFrom: string,
    dateTo: string,
    unitIds?: number[]
  ): DeliveredReceiptInfo[] {
    return this.safeExecute(() => {
      const params: (string | number)[] = []

      let unitFilter = ''
      if (unitIds && unitIds.length > 0) {
        const placeholders = unitIds.map(() => '?').join(', ')
        unitFilter = `AND (d.unit_id IN (${placeholders}) OR d.parent_unit_id IN (${placeholders}))`
        params.push(...unitIds, ...unitIds)
      }

      // delivery_date YYYY-MM-DD HH:MM:SS formatında — DATE() ile gün bazlı karşılaştır
      params.push(dateFrom, dateTo)

      const sql = `
        SELECT
          d.id AS distribution_id,
          d.receipt_no,
          d.delivery_date,
          d.document_id,
          doc.record_date,
          doc.source_office,
          doc.reference_number,
          doc.subject,
          doc.document_date,
          doc.document_type,
          doc.classification_id,
          doc.security_control_no,
          COALESCE(u.short_name, u.name, CAST(d.unit_id AS TEXT)) AS unit_name,
          doc.attachment_count,
          doc.page_count,
          d.delivered_by_name
        FROM ${TABLE_NAME} d
        INNER JOIN incoming_documents doc ON d.document_id = doc.id
        INNER JOIN channels ch ON d.channel_id = ch.id
        LEFT JOIN units u ON d.unit_id = u.id
        WHERE d.is_delivered = 1
          AND d.document_scope = 'INCOMING'
          AND LOWER(ch.name) = 'kurye'
          ${unitFilter}
          AND DATE(d.delivery_date) >= ?
          AND DATE(d.delivery_date) <= ?
        ORDER BY d.receipt_no DESC, d.document_id ASC
      `
      return this.db.prepare(sql).all(...params) as DeliveredReceiptInfo[]
    })
  }
}
