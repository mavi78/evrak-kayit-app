// ============================================================
// OutgoingDocumentRepository - Giden evrak veritabanı işlemleri
// ============================================================

import { IncomingDocumentRepository } from '@main/modules/incoming-document/incoming-document.repository'

const TABLE_NAME = 'outgoing_documents'

const SCHEMA = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL,
  source_office TEXT DEFAULT '',
  reference_number TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  document_date TEXT NOT NULL,
  document_type TEXT NOT NULL,
  record_date TEXT NOT NULL,
  day_sequence_no INTEGER NOT NULL,
  attachment_count INTEGER DEFAULT 0,
  classification_id INTEGER NOT NULL,
  security_control_no TEXT DEFAULT '',
  page_count INTEGER DEFAULT 0,
  category_id INTEGER NOT NULL,
  folder_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (channel_id) REFERENCES channels(id),
  FOREIGN KEY (classification_id) REFERENCES classifications(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (folder_id) REFERENCES folders(id)
)`

export class OutgoingDocumentRepository extends IncomingDocumentRepository {
  protected override getTableName(): string {
    return TABLE_NAME
  }

  protected override getTableSchemas(): readonly string[] {
    return [SCHEMA]
  }
}
