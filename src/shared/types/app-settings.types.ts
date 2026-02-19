// ============================================================
// Uygulama Ayarları tipleri - Key-value tabanlı genel ayarlar
// ============================================================

/** Uygulama ayarı — key-value yapısı (BaseEntity kullanılmaz) */
export interface AppSetting {
  key: string
  value: string
  updated_at: string
}

/** Bilinen ayar anahtarları */
export const APP_SETTING_KEYS = {
  /** Uygulamayı kullanan birliğin ID'si */
  ORGANIZATION_UNIT_ID: 'organization_unit_id'
} as const

export type AppSettingKey = (typeof APP_SETTING_KEYS)[keyof typeof APP_SETTING_KEYS]

// ---- Request Tipleri ----

export interface GetSettingRequest {
  key: AppSettingKey
}

export interface SetSettingRequest {
  key: AppSettingKey
  value: string
}
