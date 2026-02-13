// ============================================================
// documentDateUtils - Tarihi alanından EVRAK/MESAJ ayrımı
// EVRAK: GG.AA.YYYY (DD.MM.YYYY) → document_type EVRAK, saklama GG.AA.YYYY (Türkiye standardı)
// MESAJ: 101842C ŞUB 26 / 101842Z FEB 26 → document_type MESAJ, saklama ham metin
// ============================================================

import type { DocumentDateParseResult, DocumentType } from '@shared/types'
import { formatIsoToDisplay } from './dateUtils'

/**
 * MESAJ formatı: dHHmm'zone' MMM yy
 * d: 1-2 rakam (gün)
 * HHmm: 4 rakam (saat dakika)
 * zone: C, B, Z (büyük/küçük harf)
 * MMM: 3 harfli ay
 * yy: 2 rakam yıl
 * Örnek: 101842C ŞUB 26, 11200Z FEB 25, 50930B OCA 24
 */
// Regex tanımlarını tek bir yerde toplayalım
const MESAJ_REGEX = /^(\d{1,2})(\d{4})[CBZcbz]\s+([A-Za-zÜŞĞIÖÇüşğıöç]{3})\s+(\d{2})$/

/**
 * Klasik tarih formatı: DD.MM.YYYY (nokta ile)
 */
const EVRAK_DATE_PATTERN = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/

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

  // Regex check (ön eleme)
  if (MESAJ_REGEX.test(trimmed)) {
    // Regex tutsa bile isValidDocumentDateInput mantıksal kontrolünü (takvim günü vb) yapmalı.
    // Ancak sadece parsing aşamasında DocumentType belirlemek için regex yeterli.
    // Format geçerli mi değil mi kontrolü daha sonra isValidDocumentDateInput ile yapılacak.
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

  // Katı kural: Sadece EVRAK veya MESAJ formatı kabul edilir.
  // ISO formatı (YYYY-MM-DD) artık giriş olarak kabul edilmiyor, sadece DD.MM.YYYY.
  // Eğer formatlar tutmuyorsa, varsayılan olarak EVRAK döner ama validasyondan geçmez.

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
 * EVRAK ise, gizlilik derecesi gerektirmiyorsa devre dışı olmalı.
 */
export function isSecurityControlNoDisabled(
  documentType: DocumentType,
  classificationRequiresSecurityNumber: boolean
): boolean {
  if (documentType === 'MESAJ') return true
  return !classificationRequiresSecurityNumber
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

  if (EVRAK_DATE_PATTERN.test(v)) return v

  // YYYY-MM-DD formatında ise çevir
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const formatted = formatIsoToDisplay(v)
    return formatted !== '—' ? formatted : v
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

/**
 * Validation sonucu
 */
export interface DateValidationResult {
  valid: boolean
  message?: string
}

/**
 * Tarihi alanının geçerli formatta ve mantıksal olarak doğru olup olmadığını kontrol eder.
 * Hata durumunda kullanıcıya gösterilecek mesajı da döner.
 */
export function validateDocumentDate(input: string): DateValidationResult {
  const trimmed = (input ?? '').trim()
  if (!trimmed) {
    return { valid: false, message: 'Tarihi alanı zorunludur.' }
  }

  // 1. EVRAK Kontrolü
  const evrakMatch = trimmed.match(EVRAK_DATE_PATTERN)
  if (evrakMatch) {
    const [, d, m, y] = evrakMatch
    const day = parseInt(d!, 10)
    const month = parseInt(m!, 10)
    const year = parseInt(y!, 10)
    // Geçerli tarih kontrolü
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      const date = new Date(
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      )
      if (
        !Number.isNaN(date.getTime()) &&
        date.getDate() === day &&
        date.getMonth() + 1 === month
      ) {
        return { valid: true }
      }
    }
    return { valid: false, message: 'Lütfen geçerli bir tarih giriniz' }
  }

  // 2. MESAJ Kontrolü
  const mesajGroups = trimmed.match(MESAJ_REGEX)
  if (mesajGroups) {
    const [, dStr, timeStr, monthStr, yearStr] = mesajGroups
    const day = parseInt(dStr!, 10)
    const hour = parseInt(timeStr!.substring(0, 2), 10)
    const minute = parseInt(timeStr!.substring(2, 4), 10)
    const monthName = monthStr!.toUpperCase()
    const year2Digit = parseInt(yearStr!, 10)
    const year = 2000 + year2Digit

    const monthIndex = MONTH_MAP[monthName]
    if (monthIndex === undefined) {
      return { valid: false, message: 'Lütfen geçerli bir TSG giriniz' }
    }

    // Saat kontrolü (0-23)
    if (hour < 0 || hour > 23) {
      return { valid: false, message: 'Lütfen geçerli bir TSG giriniz' }
    }

    // Dakika kontrolü (0-59)
    if (minute < 0 || minute > 59) {
      return { valid: false, message: 'Lütfen geçerli bir TSG giriniz' }
    }

    // Takvim kontrolü (Ayın gün sayısı)
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    if (day < 1 || day > daysInMonth) {
      return { valid: false, message: 'Lütfen geçerli bir TSG giriniz' }
    }

    return { valid: true }
  }

  // Format hiç uymuyorsa
  return {
    valid: false,
    message:
      'Tarih formatı geçersiz! Lütfen "GG.AA.YYYY" (örn: 12.02.2026) veya Mesaj Tarihi (örn: 121530C ŞUB 26) formatında giriniz.'
  }
}

/**
 * Ay isimleri mapping (TR/EN karışık, case insensitive)
 */
const MONTH_MAP: Record<string, number> = {
  OCAK: 0,
  OCA: 0,
  JAN: 0,
  JANUARY: 0,
  ŞUBAT: 1,
  SUBAT: 1,
  ŞUB: 1,
  SUB: 1,
  FEB: 1,
  FEBRUARY: 1,
  MART: 2,
  MRT: 2,
  MAR: 2,
  MARCH: 2,
  NİSAN: 3,
  NISAN: 3,
  NSN: 3,
  APR: 3,
  APRIL: 3,
  MAYIS: 4,
  MAY: 4,
  HAZİRAN: 5,
  HAZIRAN: 5,
  HAZ: 5,
  JUN: 5,
  JUNE: 5,
  TEMMUZ: 6,
  TEM: 6,
  JUL: 6,
  JULY: 6,
  AĞUSTOS: 7,
  AGUSTOS: 7,
  AĞU: 7,
  AGU: 7,
  AUG: 7,
  AUGUST: 7,
  EYLÜL: 8,
  EYLUL: 8,
  EYL: 8,
  SEP: 8,
  SEPTEMBER: 8,
  EKİM: 9,
  EKIM: 9,
  EKİ: 9,
  EKI: 9,
  OCT: 9,
  OCTOBER: 9,
  KASIM: 10,
  KAS: 10,
  NOV: 10,
  NOVEMBER: 10,
  ARALIK: 11,
  ARA: 11,
  DEC: 11,
  DECEMBER: 11
}

/**
 * Belge tarihini (EVRAK veya MESAJ formatı) ISO string'e (Date) çevirir.
 * Backend'e gerçek tarih formatında göndermek için kullanılır.
 * @param input - EVRAK (dd.MM.yyyy) veya MESAJ (dHHmm'Z' MMM yy) formatında string
 * @returns ISO string (yyyy-MM-ddTHH:mm:00.000Z) veya null
 */
export function convertDocumentDateToIso(input: string): string | null {
  const trimmed = (input ?? '').trim()
  if (!trimmed) return null

  // 1. EVRAK Formatı: dd.MM.yyyy
  const evrakMatch = trimmed.match(EVRAK_DATE_PATTERN)
  if (evrakMatch) {
    const [, d, m, y] = evrakMatch
    const day = parseInt(d!, 10)
    const month = parseInt(m!, 10) - 1 // JS ayları 0-11
    const year = parseInt(y!, 10)

    // Strict date check:
    // new Date(2026, 1, 29) -> 1 Mart olur. Month değişir.
    const date = new Date(Date.UTC(year, month, day))

    if (
      !Number.isNaN(date.getTime()) &&
      date.getUTCDate() === day &&
      date.getUTCMonth() === month &&
      date.getUTCFullYear() === year
    ) {
      return date.toISOString()
    }
  }

  // 2. MESAJ Formatı: dHHmm'zone' MMM yy
  const mesajGroups = trimmed.match(MESAJ_REGEX)
  if (mesajGroups) {
    const [, dStr, timeStr, monthStr, yearStr] = mesajGroups

    const day = parseInt(dStr!, 10)
    const hour = parseInt(timeStr!.substring(0, 2), 10)
    const minute = parseInt(timeStr!.substring(2, 4), 10)
    const monthName = monthStr!.toUpperCase()
    const year2Digit = parseInt(yearStr!, 10)
    const year = 2000 + year2Digit

    const monthIndex = MONTH_MAP[monthName]

    if (monthIndex !== undefined) {
      // Takvim kontrolü (Convert aşamasında da kontrol etmek iyidir)
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
      if (day > daysInMonth) return null

      const date = new Date(Date.UTC(year, monthIndex, day, hour, minute, 0))
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString()
      }
    }
  }

  return null
}
