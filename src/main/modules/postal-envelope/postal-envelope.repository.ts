// ============================================================
// PostalEnvelopeRepository - Posta zarfı veritabanı işlemleri
//
// Sorumlulukları:
// 1. postal_envelopes + postal_envelope_stamps tablo şeması
// 2. document_distributions tablosuna postal_envelope_id kolon migration
// 3. Bekleyenler havuzu sorgusu (Posta kanalı + zarflanmamış)
// 4. Atomik zarf oluşturma (zarf + pullar + dağıtım güncelleme)
// 5. Zarf detay ve geçmiş sorguları
// ============================================================

import { BaseRepository } from '@main/core/BaseRepository'
import type {
  PostalEnvelope,
  PostalEnvelopeStampDetail,
  PostalEnvelopeDetail,
  PostalEnvelopeDistributionInfo,
  PendingPostalDistribution,
  EnvelopeStampInput
} from '@shared/types'

const TABLE_NAME = 'postal_envelopes'

const ENVELOPE_SCHEMA = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_name TEXT NOT NULL,
  rr_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
)`

const ENVELOPE_STAMPS_SCHEMA = `CREATE TABLE IF NOT EXISTS postal_envelope_stamps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  postal_envelope_id INTEGER NOT NULL,
  postal_stamp_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (postal_envelope_id) REFERENCES postal_envelopes(id),
  FOREIGN KEY (postal_stamp_id) REFERENCES postal_stamps(id)
)`

export class PostalEnvelopeRepository extends BaseRepository<PostalEnvelope> {
  constructor() {
    super()
    // Tablo oluşturulduktan sonra migration: document_distributions'a postal_envelope_id ekle
    this.migrateDistributionsTable()
  }

  protected getTableName(): string {
    return TABLE_NAME
  }

  protected getTableSchemas(): readonly string[] {
    return [ENVELOPE_SCHEMA, ENVELOPE_STAMPS_SCHEMA]
  }

  /** document_distributions tablosuna postal_envelope_id kolonu ekler (yoksa) */
  private migrateDistributionsTable(): void {
    this.safeExecute(() => {
      // Kolon var mı kontrol et
      const tableInfo = this.db
        .prepare(`PRAGMA table_info(document_distributions)`)
        .all() as Array<{ name: string }>
      const hasColumn = tableInfo.some((col) => col.name === 'postal_envelope_id')
      if (!hasColumn) {
        this.db.exec(
          `ALTER TABLE document_distributions ADD COLUMN postal_envelope_id INTEGER REFERENCES postal_envelopes(id)`
        )
      }

      // notes → rr_code kolon rename migration
      const envelopeInfo = this.db.prepare(`PRAGMA table_info(${TABLE_NAME})`).all() as Array<{
        name: string
      }>
      const hasNotes = envelopeInfo.some((col) => col.name === 'notes')
      if (hasNotes) {
        this.db.exec(`ALTER TABLE ${TABLE_NAME} RENAME COLUMN notes TO rr_code`)
      }
    })
  }

  /**
   * Bekleyenler havuzu — Posta kanalı + zarflanmamış dağıtımlar.
   * JOIN: document_distributions → channels (name = 'Posta') → incoming_documents → units
   */
  getPendingDistributions(): PendingPostalDistribution[] {
    return this.safeExecute(() => {
      const stmt = this.db.prepare(`
        SELECT
          dd.id AS distribution_id,
          dd.document_id,
          doc.subject AS document_subject,
          doc.reference_number AS document_reference_number,
          doc.record_date AS document_record_date,
          dd.unit_id,
          u.name AS unit_name,
          dd.parent_unit_id,
          pu.name AS parent_unit_name
        FROM document_distributions dd
        INNER JOIN channels ch ON dd.channel_id = ch.id
        LEFT JOIN incoming_documents doc ON dd.document_id = doc.id
        INNER JOIN units u ON dd.unit_id = u.id
        LEFT JOIN units pu ON dd.parent_unit_id = pu.id
        WHERE LOWER(ch.name) = 'posta'
          AND dd.postal_envelope_id IS NULL
        ORDER BY COALESCE(dd.parent_unit_id, dd.unit_id), dd.unit_id, dd.document_id
      `)
      return stmt.all() as PendingPostalDistribution[]
    })
  }

  /**
   * Atomik zarf oluşturma — tek transaction:
   * 1. postal_envelopes kaydı oluştur
   * 2. postal_envelope_stamps kayıtları ekle
   * 3. Seçilen distribution'ların postal_envelope_id'sini güncelle
   */
  createEnvelopeWithStamps(
    recipientName: string,
    rrCode: string,
    distributionIds: number[],
    stamps: EnvelopeStampInput[]
  ): PostalEnvelope {
    return this.safeTransaction(() => {
      // 1. Zarf oluştur (text alanları büyük harfe çevir)
      const upperRecipientName = this.toUpperCaseTr(recipientName.trim())
      const upperRrCode = rrCode.trim() ? this.toUpperCaseTr(rrCode.trim()) : ''
      const insertEnvelope = this.db.prepare(
        `INSERT INTO ${TABLE_NAME} (recipient_name, rr_code) VALUES (?, ?)`
      )
      const result = insertEnvelope.run(upperRecipientName, upperRrCode)
      const envelopeId = result.lastInsertRowid as number

      // 2. Pulları ekle
      const insertStamp = this.db.prepare(
        `INSERT INTO postal_envelope_stamps (postal_envelope_id, postal_stamp_id, quantity) VALUES (?, ?, ?)`
      )
      for (const stamp of stamps) {
        insertStamp.run(envelopeId, stamp.postal_stamp_id, stamp.quantity)
      }

      // 3. Dağıtımları zarfla ilişkilendir ve teslim edildi olarak işaretle
      const updateDist = this.db.prepare(
        `UPDATE document_distributions SET postal_envelope_id = ?, is_delivered = 1, delivery_date = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      for (const distId of distributionIds) {
        updateDist.run(envelopeId, distId)
      }

      return this.findById(envelopeId) as PostalEnvelope
    })
  }

  /** Tek zarf detayı — zarf + pullar + evraklar */
  getEnvelopeDetail(envelopeId: number): PostalEnvelopeDetail | null {
    return this.safeExecute(() => {
      // Zarf
      const envelope = this.findById(envelopeId)
      if (!envelope) return null

      // Pullar (JOIN postal_stamps)
      const stampsStmt = this.db.prepare(`
        SELECT
          pes.id,
          pes.postal_envelope_id,
          pes.postal_stamp_id,
          pes.quantity,
          pes.created_at,
          pes.updated_at,
          ps.amount AS stamp_amount
        FROM postal_envelope_stamps pes
        INNER JOIN postal_stamps ps ON pes.postal_stamp_id = ps.id
        WHERE pes.postal_envelope_id = ?
      `)
      const stamps = stampsStmt.all(envelopeId) as PostalEnvelopeStampDetail[]

      // Toplam maliyet
      const totalCost = stamps.reduce((sum, s) => sum + s.stamp_amount * s.quantity, 0)

      // Dağıtımlar (evrak bilgileriyle)
      const distStmt = this.db.prepare(`
        SELECT
          dd.id AS distribution_id,
          dd.document_id,
          doc.subject AS document_subject,
          doc.reference_number AS document_reference_number,
          u.name AS unit_name,
          pu.name AS parent_unit_name
        FROM document_distributions dd
        LEFT JOIN incoming_documents doc ON dd.document_id = doc.id
        INNER JOIN units u ON dd.unit_id = u.id
        LEFT JOIN units pu ON dd.parent_unit_id = pu.id
        WHERE dd.postal_envelope_id = ?
        ORDER BY dd.document_id
      `)
      const distributions = distStmt.all(envelopeId) as PostalEnvelopeDistributionInfo[]

      return {
        ...envelope,
        stamps,
        distributions,
        total_cost: totalCost
      }
    })
  }

  /** Tüm zarflar — geçmiş listesi (detaylı) */
  getAllEnvelopes(): PostalEnvelopeDetail[] {
    return this.safeExecute(() => {
      const envelopes = this.findAll()
      return envelopes.map((env) => {
        const detail = this.getEnvelopeDetail(env.id)
        return detail!
      })
    })
  }

  /**
   * Mevcut zarfı güncelle — tek transaction:
   * 1. recipient_name ve rr_code güncelle
   * 2. Eski pulları sil → yeni pulları ekle
   * Dağıtım ilişkileri değişmez.
   */
  updateEnvelopeWithStamps(
    envelopeId: number,
    recipientName: string,
    rrCode: string,
    stamps: EnvelopeStampInput[]
  ): PostalEnvelope {
    return this.safeTransaction(() => {
      const upperRecipientName = this.toUpperCaseTr(recipientName.trim())
      const upperRrCode = rrCode.trim() ? this.toUpperCaseTr(rrCode.trim()) : '-'

      // 1. Zarf bilgilerini güncelle
      this.db
        .prepare(
          `UPDATE ${TABLE_NAME} SET recipient_name = ?, rr_code = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(upperRecipientName, upperRrCode, envelopeId)

      // 2. Eski pulları sil
      this.db
        .prepare(`DELETE FROM postal_envelope_stamps WHERE postal_envelope_id = ?`)
        .run(envelopeId)

      // 3. Yeni pulları ekle
      const insertStamp = this.db.prepare(
        `INSERT INTO postal_envelope_stamps (postal_envelope_id, postal_stamp_id, quantity) VALUES (?, ?, ?)`
      )
      for (const stamp of stamps) {
        insertStamp.run(envelopeId, stamp.postal_stamp_id, stamp.quantity)
      }

      return this.findById(envelopeId) as PostalEnvelope
    })
  }

  /**
   * Dağıtım silme öncesi posta zarfı bağlantısını temizler.
   * 1. distribution'ın postal_envelope_id'sini al
   * 2. postal_envelope_id'yi NULL yap
   * 3. Zarfta başka dağıtım kalmadıysa zarfı ve pullarını sil
   * @returns true eğer zarfa bağlıysa (kullanıcıya uyarı göstermek için)
   */
  unlinkDistribution(distributionId: number): boolean {
    return this.safeTransaction(() => {
      // 1. Bu dağıtımın zarfını bul
      const row = this.db
        .prepare(`SELECT postal_envelope_id FROM document_distributions WHERE id = ?`)
        .get(distributionId) as { postal_envelope_id: number | null } | undefined

      if (!row || !row.postal_envelope_id) return false

      const envelopeId = row.postal_envelope_id

      // 2. Dağıtımın zarf bağlantısını kaldır
      this.db
        .prepare(
          `UPDATE document_distributions SET postal_envelope_id = NULL, is_delivered = 0, delivery_date = NULL, updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(distributionId)

      // 3. Zarfta başka dağıtım kalmış mı kontrol et
      const remaining = this.db
        .prepare(`SELECT COUNT(*) as cnt FROM document_distributions WHERE postal_envelope_id = ?`)
        .get(envelopeId) as { cnt: number }

      // 4. Kalmadıysa zarfı ve pullarını sil
      if (remaining.cnt === 0) {
        this.db
          .prepare(`DELETE FROM postal_envelope_stamps WHERE postal_envelope_id = ?`)
          .run(envelopeId)
        this.db.prepare(`DELETE FROM ${TABLE_NAME} WHERE id = ?`).run(envelopeId)
      }

      return true
    })
  }

  /**
   * Bir dağıtımın posta zarfına bağlı olup olmadığını kontrol eder.
   */
  isDistributionLinkedToEnvelope(distributionId: number): boolean {
    return this.safeExecute(() => {
      const row = this.db
        .prepare(`SELECT postal_envelope_id FROM document_distributions WHERE id = ?`)
        .get(distributionId) as { postal_envelope_id: number | null } | undefined
      return !!row?.postal_envelope_id
    })
  }
}
