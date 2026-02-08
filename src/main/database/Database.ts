// ============================================================
// Database Singleton - Tek bağlantı üzerinden veritabanı yönetimi
// Sadece bağlantı ve yapılandırma. Tablo oluşturma repository'lerde.
// ============================================================

import BetterSqlite3 from 'better-sqlite3'
import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { Logger } from '@main/core/Logger'

export class Database {
  private static instance: Database | null = null
  private db: BetterSqlite3.Database
  private logger: Logger

  private constructor() {
    this.logger = Logger.getInstance()
    const dbPath = this.getDbPath()
    this.ensureDirectory(dbPath)

    this.db = new BetterSqlite3(dbPath)
    this.configure()

    this.logger.info(`Veritabanı bağlantısı kuruldu: ${dbPath}`, 'Database')
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database()
    }
    return Database.instance
  }

  getConnection(): BetterSqlite3.Database {
    return this.db
  }

  private getDbPath(): string {
    if (is.dev) {
      return join(app.getAppPath(), 'data', 'evrak-kayit.db')
    }
    return join(dirname(app.getPath('exe')), 'data', 'evrak-kayit.db')
  }

  private ensureDirectory(dbPath: string): void {
    const dir = dirname(dbPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  /** SQLite pragma ayarları - ağ paylaşımında güvenli çalışma için */
  private configure(): void {
    // DELETE modu ağ paylaşımlarında WAL'dan daha güvenilir
    this.db.pragma('journal_mode = DELETE')
    // Yazma kilitlerinde 10 saniye bekle (ağ gecikmesi için)
    this.db.pragma('busy_timeout = 10000')
    // Referans bütünlüğü
    this.db.pragma('foreign_keys = ON')
    // Performans/güvenlik dengesi
    this.db.pragma('synchronous = NORMAL')
  }

  close(): void {
    if (this.db) {
      this.db.close()
      Database.instance = null
      this.logger.info('Veritabanı bağlantısı kapatıldı', 'Database')
    }
  }
}
