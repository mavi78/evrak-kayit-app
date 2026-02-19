// ============================================================
// PostalStampRepository - Posta pulu veritabanı işlemleri
//
// Sorumlulukları:
// 1. postal_stamps tablosu CRUD
// ============================================================

import { BaseRepository } from '@main/core/BaseRepository'
import type { PostalStamp } from '@shared/types'

export class PostalStampRepository extends BaseRepository<PostalStamp> {
  protected getTableName(): string {
    return 'postal_stamps'
  }

  protected override getBooleanColumns(): readonly string[] {
    return ['is_active']
  }

  protected getTableSchemas(): readonly string[] {
    return [
      `CREATE TABLE IF NOT EXISTS postal_stamps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      )`
    ]
  }
}
