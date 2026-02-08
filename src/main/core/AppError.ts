// ============================================================
// Merkezi Hata Sınıfı - Standart HTTP durum kodları ile hata yönetimi
// Tüm DB, iş kuralı ve yetki hataları bu sınıftan türer.
// ============================================================

import { STATUS_CODES } from '@shared/utils/constants'

export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    Object.setPrototypeOf(this, AppError.prototype)
  }

  /** 400 - Geçersiz istek */
  static badRequest(message: string): AppError {
    return new AppError(message, STATUS_CODES.BAD_REQUEST)
  }

  /** 401 - Kimlik doğrulanamadı */
  static unauthorized(message: string): AppError {
    return new AppError(message, STATUS_CODES.UNAUTHORIZED)
  }

  /** 403 - Yetkisiz erişim */
  static forbidden(message: string): AppError {
    return new AppError(message, STATUS_CODES.FORBIDDEN)
  }

  /** 404 - Kayıt bulunamadı */
  static notFound(message: string): AppError {
    return new AppError(message, STATUS_CODES.NOT_FOUND)
  }

  /** 409 - Çakışma (benzersizlik ihlali) */
  static conflict(message: string): AppError {
    return new AppError(message, STATUS_CODES.CONFLICT)
  }

  /** 500 - İç sunucu hatası */
  static internal(message: string): AppError {
    return new AppError(message, STATUS_CODES.INTERNAL_ERROR, false)
  }

  /** 503 - Veritabanı meşgul / servis kullanılamıyor */
  static busy(message: string): AppError {
    return new AppError(message, STATUS_CODES.SERVICE_UNAVAILABLE)
  }
}
