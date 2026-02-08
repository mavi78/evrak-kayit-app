// ============================================================
// Bildirim Yardımcıları - Backend hatalarını kullanıcıya gösterir
// Backend'den gelen hata mesajları burada bildirim olarak gösterilir.
// ============================================================

import { notifications } from '@mantine/notifications'
import type { ServiceResponse } from '@shared/types'

/** Hata bildirimi göster */
export function showError(message: string, title: string = 'Hata'): void {
  notifications.show({
    title,
    message,
    color: 'red',
    autoClose: 5000
  })
}

/** Başarı bildirimi göster */
export function showSuccess(message: string, title: string = 'Başarılı'): void {
  notifications.show({
    title,
    message,
    color: 'green',
    autoClose: 3000
  })
}

/** Uyarı bildirimi göster */
export function showWarning(message: string, title: string = 'Uyarı'): void {
  notifications.show({
    title,
    message,
    color: 'yellow',
    autoClose: 4000
  })
}

/**
 * API yanıtını işle - hata varsa bildirim göster, başarı opsiyonel.
 * API çağrılarından sonra tek satırla kullanılır:
 *
 * const response = await authApi.create(data)
 * handleApiResponse(response, { successMessage: 'Kullanıcı oluşturuldu', showSuccess: true })
 */
export function handleApiResponse<T>(
  response: ServiceResponse<T>,
  options?: { successMessage?: string; showSuccess?: boolean }
): ServiceResponse<T> {
  if (!response.success) {
    showError(response.message, `Hata (${response.statusCode})`)
  } else if (options?.showSuccess) {
    showSuccess(options.successMessage ?? response.message)
  }
  return response
}
