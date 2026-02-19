// ============================================================
// dateUtils - date-fns merkezi utility fonksiyonları
// Tüm tarih formatlama işlemleri buradan yapılır
// ============================================================

import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

/**
 * Türkçe locale - tüm formatlamalarda kullanılır
 */
export const turkishLocale = tr

/**
 * Tarihi DD.MM.YYYY formatında formatlar
 * @param date - Date nesnesi veya ISO string
 * @returns DD.MM.YYYY formatında tarih
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(dateObj.getTime())) return '—'
  return format(dateObj, 'dd.MM.yyyy', { locale: tr })
}

/**
 * Tarihi DD.MM.YYYY HH:mm formatında formatlar
 * @param date - Date nesnesi veya ISO string
 * @returns DD.MM.YYYY HH:mm formatında tarih
 */
export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(dateObj.getTime())) return '—'
  return format(dateObj, 'dd.MM.yyyy HH:mm', { locale: tr })
}

/**
 * Tarihi DD.MM.YYYY HH:mm:ss formatında formatlar
 * @param date - Date nesnesi veya ISO string
 * @returns DD.MM.YYYY HH:mm:ss formatında tarih
 */
export function formatDateTimeFull(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(dateObj.getTime())) return '—'
  return format(dateObj, 'dd.MM.yyyy HH:mm:ss', { locale: tr })
}

/**
 * Sadece saati HH:mm formatında formatlar
 * @param date - Date nesnesi veya ISO string
 * @returns HH:mm formatında saat
 */
export function formatTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(dateObj.getTime())) return '—'
  return format(dateObj, 'HH:mm', { locale: tr })
}

/**
 * Veritabanı için yyyy-MM-dd HH:mm:ss formatında formatlar
 * @param date - Date nesnesi (opsiyonel, varsayılan: şimdi)
 * @returns yyyy-MM-dd HH:mm:ss formatında tarih
 */
export function formatForDatabase(date?: Date): string {
  const dateObj = date ?? new Date()
  return format(dateObj, 'yyyy-MM-dd HH:mm:ss')
}

/**
 * Log dosyası adı için yyyy-MM-dd formatında formatlar
 * @param date - Date nesnesi (opsiyonel, varsayılan: şimdi)
 * @returns yyyy-MM-dd formatında tarih
 */
export function formatForLogFileName(date?: Date): string {
  const dateObj = date ?? new Date()
  return format(dateObj, 'yyyy-MM-dd', { locale: tr })
}

/**
 * Log satırı için yyyy-MM-dd HH:mm:ss formatında formatlar.
 * formatForDatabase ile aynı çıktıyı üretir (sayısal format, locale etkisiz).
 * @param date - Date nesnesi (opsiyonel, varsayılan: şimdi)
 * @returns yyyy-MM-dd HH:mm:ss formatında tarih
 */
export function formatForLogLine(date?: Date): string {
  return formatForDatabase(date)
}

/**
 * ISO string'i (YYYY-MM-DD veya YYYY-MM-DD HH:mm:ss) DD.MM.YYYY formatına çevirir
 * @param isoString - ISO formatında tarih string'i
 * @returns DD.MM.YYYY formatında tarih veya '—'
 */
export function formatIsoToDisplay(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  const dateObj = new Date(isoString)
  if (Number.isNaN(dateObj.getTime())) return '—'
  return format(dateObj, 'dd.MM.yyyy', { locale: tr })
}

/**
 * ISO string'i (YYYY-MM-DD veya YYYY-MM-DD HH:mm:ss) DD.MM.YYYY HH:mm formatına çevirir
 * @param isoString - ISO formatında tarih string'i
 * @returns DD.MM.YYYY HH:mm formatında tarih veya '—'
 */
export function formatIsoToDisplayWithTime(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  const dateObj = new Date(isoString)
  if (Number.isNaN(dateObj.getTime())) return '—'

  // Eğer sadece tarih varsa (saat yoksa), sadece tarih döndür
  const hasTime = isoString.includes(' ') || isoString.includes('T')
  if (!hasTime) {
    return format(dateObj, 'dd.MM.yyyy', { locale: tr })
  }

  return format(dateObj, 'dd.MM.yyyy HH:mm', { locale: tr })
}
