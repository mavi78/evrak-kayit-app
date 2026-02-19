// ============================================================
// AppSettingsRepository - Key-value uygulama ayarları
//
// Sorumlulukları:
// 1. app_settings tablosu (key TEXT PK, value TEXT, updated_at TEXT)
// 2. getSetting / setSetting (UPSERT) işlemleri
// ============================================================

import BetterSqlite3 from 'better-sqlite3'
import { Database } from '@main/database/Database'
import { Logger } from '@main/core/Logger'
import { AppError } from '@main/core/AppError'
import { formatForDatabase } from '@shared/utils'
import type { AppSetting, AppSettingKey } from '@shared/types'

const TABLE_NAME = 'app_settings'

const SCHEMA = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
)`

export class AppSettingsRepository {
  private db: BetterSqlite3.Database
  private logger: Logger

  constructor() {
    this.db = Database.getInstance().getConnection()
    this.logger = Logger.getInstance()
    this.initializeTable()
  }

  private initializeTable(): void {
    try {
      this.db.exec(SCHEMA)
      this.logger.debug(`Tablo hazır: ${TABLE_NAME}`, 'AppSettingsRepository')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      throw AppError.internal(`Tablo oluşturma hatası: ${msg}`)
    }
  }

  /** Ayar değerini getirir */
  getSetting(key: AppSettingKey): AppSetting | null {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLE_NAME} WHERE key = ?`)
    const row = stmt.get(key) as AppSetting | undefined
    return row ?? null
  }

  /** Ayar değerini kaydeder (yoksa oluşturur, varsa günceller) */
  setSetting(key: AppSettingKey, value: string): AppSetting {
    const now = formatForDatabase()
    const stmt = this.db.prepare(
      `INSERT INTO ${TABLE_NAME} (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    stmt.run(key, value, now)

    const result = this.getSetting(key)
    if (!result) throw AppError.internal('Ayar kaydedilemedi')
    return result
  }
}
