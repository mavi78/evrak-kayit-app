// ============================================================
// documentDateUtils - Tarihi alanından EVRAK/MESAJ ayrımı
// EVRAK: GG.AA.YYYY (DD.MM.YYYY) → document_type EVRAK, saklama GG.AA.YYYY (Türkiye standardı)
// MESAJ: 101842C ŞUB 26 / 101842Z FEB 26 → document_type MESAJ, saklama ham metin
// ============================================================

import type { DocumentDateParseResult, DocumentType } from '@shared/types'

/**
 * ZULU/MESAJ formatı: 6 rakam + C veya Z + boşluk + 3 harfli ay (TR/EN) + boşluk + 2 rakam yıl.
 * Örnek: 101842C ŞUB 26, 101842Z FEB 26
 */
const MESAJ_PATTERN = /^\d{6}[CZ]\s+[A-Za-zÜŞĞIÖÇüşğıöç]{3}\s+\d{2}$/

/**
 * Klasik tarih formatı: DD.MM.YYYY (nokta ile)
 */
const EVRAK_DATE_PATTERN = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/

/**
 * MESAJ formatı 2: d'zoneLetter' MMM yy
 * d: 1-2 rakam (gün)
 * zoneLetter: tek harf (C, B, Z gibi, büyük/küçük harf)
 * MMM: 3 harfli ay (TR/EN)
 * yy: 2 rakam (yıl)
 * Örnek: 12C Şub 26, 5B Oca 24, 101842C ŞUB 26
 */
const MESAJ_PATTERN_2 = /^\d{1,6}[A-Za-z]\s+[A-Za-zÜŞĞIÖÇüşğıöç]{3}\s+\d{2}$/

/**
 * Tarihi alanı girişini ayrıştırır; EVRAK veya MESAJ türünü ve saklanacak değeri döner.
 * EVRAK için GG.AA.YYYY (DD.MM.YYYY) formatında saklar (Türkiye standardı).
 * @param input - Kullanıcının girdiği Tarihi değeri (örn. "10.02.2026" veya "101842Z FEB 26")
 * @returns document_type ve saklanacak dateValue (EVRAK: GG.AA.YYYY, MESAJ: ham metin)
 */
export function parseDocumentDateInput(input: string): DocumentDateParseResult {
  const trimmed = (input ?? '').trim()
  if (!trimmed) {
    return { type: 'EVRAK', dateValue: '' }
  }

  if (MESAJ_PATTERN.test(trimmed)) {
    return { type: 'MESAJ', dateValue: trimmed }
  }

  const evrakMatch = trimmed.match(EVRAK_DATE_PATTERN)
  if (evrakMatch) {
    const [, d, m, y] = evrakMatch
    const day = d!.padStart(2, '0')
    const month = m!.padStart(2, '0')
    const year = y!
    const date = new Date(`${year}-${month}-${day}`)
    if (!Number.isNaN(date.getTime())) {
      return { type: 'EVRAK', dateValue: `${day}.${month}.${year}` }
    }
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    return { type: 'EVRAK', dateValue: `${d}.${m}.${y}` }
  }

  return { type: 'EVRAK', dateValue: trimmed }
}

/**
 * Belge türüne ve gizlilik derecesine göre güvenlik kontrol numarası zorunluluğu.
 * MESAJ ise zorunlu değil ve alan disable edilir.
 * @param documentType - EVRAK | MESAJ
 * @param classificationRequiresSecurityNumber - Gizlilik derecesindeki requires_security_number
 */
export function isSecurityControlNoRequired(
  documentType: DocumentType,
  classificationRequiresSecurityNumber: boolean
): boolean {
  if (documentType === 'MESAJ') return false
  return classificationRequiresSecurityNumber
}

/**
 * MESAJ ise güvenlik kontrol no alanı devre dışı olmalı.
 */
export function isSecurityControlNoDisabled(documentType: DocumentType): boolean {
  return documentType === 'MESAJ'
}

/**
 * Arama terimini evrak tarihi formatına (GG.AA.YYYY) çevirir.
 * Girdi GG.AA.YYYY veya YYYY-MM-DD ise normalize edilmiş GG.AA.YYYY döner.
 * @param query - Arama terimi
 * @returns GG.AA.YYYY formatında tarih veya null
 */
export function parseSearchDateToDisplayFormat(query: string): string | null {
  const trimmed = (query ?? '').trim()
  const ddmmMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (ddmmMatch) {
    const [, d, m, y] = ddmmMatch
    const day = d!.padStart(2, '0')
    const month = m!.padStart(2, '0')
    const date = new Date(`${y}-${month}-${day}`)
    return Number.isNaN(date.getTime()) ? null : `${day}.${month}.${y}`
  }
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    return `${d}.${m}.${y}`
  }
  return null
}

/**
 * document_date alanını E.TAR sütununda göstermek için formatlar.
 * GG.AA.YYYY zaten doğru formatta; YYYY-MM-DD (eski kayıtlar) GG.AA.YYYY'ya dönüştürülür.
 * @param value - document_date değeri (EVRAK: GG.AA.YYYY veya YYYY-MM-DD, MESAJ: ham metin)
 * @returns GG.AA.YYYY veya ham metin
 */
export function formatDocumentDateForDisplay(value: string): string {
  const v = (value ?? '').trim()
  if (!v) return '—'
  const ddmmMatch = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (ddmmMatch) return v
  const isoMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    return `${d}.${m}.${y}`
  }
  return v
}

/**
 * Tarihi alanının geçerli formatta olup olmadığını kontrol eder.
 * İki format kabul edilir:
 * 1. dd.MM.yyyy (örn: 12.02.2026)
 * 2. d'zoneLetter' MMM yy (örn: 12C Şub 26, 5B Oca 24, 101842C ŞUB 26)
 * @param input - Kontrol edilecek tarihi değeri
 * @returns true ise geçerli formatta, false ise geçersiz
 */
export function isValidDocumentDateInput(input: string): boolean {
  const trimmed = (input ?? '').trim()
  if (!trimmed) return false

  // Format 1: dd.MM.yyyy
  const evrakMatch = trimmed.match(EVRAK_DATE_PATTERN)
  if (evrakMatch) {
    const [, d, m, y] = evrakMatch
    const day = parseInt(d!, 10)
    const month = parseInt(m!, 10)
    const year = parseInt(y!, 10)
    // Geçerli tarih kontrolü
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      const date = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
      return !Number.isNaN(date.getTime()) && date.getDate() === day && date.getMonth() + 1 === month
    }
    return false
  }

  // Format 2: d'zoneLetter' MMM yy veya dHHmm'zoneLetter' MMM yy
  // Örnek: 12C Şub 26, 5B Oca 24, 101842C ŞUB 26
  if (MESAJ_PATTERN.test(trimmed) || MESAJ_PATTERN_2.test(trimmed)) {
    return true
  }

  return false
}
