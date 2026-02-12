// ============================================================
// searchUtils - Metin normalizasyonu (arama + veritabanı kayıt)
// Büyük/küçük harf duyarsız + Türkçe karakter desteği
// ============================================================

/**
 * Veritabanına kaydedilecek metni Türkçe kurallarına göre büyük harfe çevirir.
 * i→İ, ı→I (Türkçe alfabe kuralları).
 * @param str - Dönüştürülecek metin
 * @returns Büyük harfli metin
 */
export function toUpperCaseTr(str: string): string {
  if (typeof str !== 'string') return ''
  return str.toLocaleUpperCase('tr-TR')
}

/**
 * Arama terimini normalize eder: küçük harfe çevirir ve Türkçe karakterleri
 * ASCII karşılıklarına dönüştürür. Böylece "süre" aranırken "sure" ile eşleşir.
 * @param str - Normalize edilecek metin
 * @returns Normalize edilmiş metin (küçük harf + ASCII)
 */
export function normalizeForSearch(str: string): string {
  if (typeof str !== 'string') return ''
  return str
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}
