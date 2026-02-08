// ============================================================
// validation - Ortak doğrulama kuralları (şifre, TC Kimlik No)
// Frontend ve backend tarafında kullanılır.
// ============================================================

import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_UPPERCASE_REGEX,
  PASSWORD_LOWERCASE_REGEX,
  TC_KIMLIK_NO_LENGTH
} from '@shared/types'

/**
 * Şifre kurallarını kontrol eder: en az 8 karakter, en az bir büyük ve bir küçük harf.
 * @param password - Kontrol edilecek şifre
 * @returns Geçerliyse null, değilse hata mesajı
 */
export function validatePassword(password: string): string | null {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return `Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalıdır`
  }
  if (!PASSWORD_UPPERCASE_REGEX.test(password)) {
    return 'Şifre en az bir büyük harf içermelidir'
  }
  if (!PASSWORD_LOWERCASE_REGEX.test(password)) {
    return 'Şifre en az bir küçük harf içermelidir'
  }
  return null
}

/**
 * TC Kimlik No formatını kontrol eder: tam 11 rakam.
 * @param tcKimlikNo - Kontrol edilecek değer
 * @returns Geçerliyse true
 */
export function isValidTcKimlikNo(tcKimlikNo: string): boolean {
  if (!tcKimlikNo || tcKimlikNo.length !== TC_KIMLIK_NO_LENGTH) return false
  return /^\d{11}$/.test(tcKimlikNo)
}
