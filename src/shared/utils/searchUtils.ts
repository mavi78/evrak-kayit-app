// ============================================================
// searchUtils - Metin normalizasyonu (arama)
// Büyük/küçük harf duyarsız + Türkçe karakter desteği
// ============================================================

/**
 * Arama terimini normalize eder: küçük harfe çevirir ve Türkçe karakterleri
 * ASCII karşılıklarına dönüştürür. Böylece "süre" aranırken "sure" ile eşleşir.
 * @param str - Normalize edilecek metin
 * @returns Normalize edilmiş metin (küçük harf + ASCII)
 */
export function normalizeForSearch(str: string): string {
  if (typeof str !== 'string') return ''
  return str
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}
