// ============================================================
// Uygulama yaşam döngüsü tipleri - yükleme ekranı ilerleme
// ============================================================

/** Yükleme adımı durumu */
export type LoadingStepStatus = 'started' | 'done' | 'error'

/** Backend'den renderer'a gönderilen yükleme ilerleme payload'ı */
export interface LoadingProgressPayload {
  /** Adım kimliği (benzersiz) */
  step: string
  /** Kullanıcıya gösterilecek mesaj */
  message: string
  /** Adım durumu */
  status: LoadingStepStatus
}
