// ============================================================
// Uygulama sabitleri - Frontend ve Backend ortak kullanım
// ============================================================

/** Sayfa anahtarları - yetkilendirme sistemi bu anahtarları kullanır */
export const PAGE_KEYS = {
  DASHBOARD: 'dashboard',
  INCOMING_DOCUMENTS: 'incoming-documents',
  OUTGOING_DOCUMENTS: 'outgoing-documents',
  TRANSIT_DOCUMENTS: 'transit-documents',
  USER_MANAGEMENT: 'user-management',
  PAGE_MANAGEMENT: 'page-management',
  SETTINGS: 'settings',
  LOGS: 'logs',
  COURIER_DELIVERED: 'courier-delivered',
  COURIER_NOT_DELIVERED: 'courier-not-delivered'
} as const

export type PageKey = (typeof PAGE_KEYS)[keyof typeof PAGE_KEYS]

/**
 * Projede gerçekten tanımlı olan (menüde/route'ta var olan) sayfa anahtarları.
 * Sayfa yönetimi ve izin ataması sadece bu listeye göre yapılır.
 * Yeni route eklendiğinde bu listeye eklenmeli.
 */
export const MENU_PAGE_KEYS: readonly PageKey[] = [
  PAGE_KEYS.DASHBOARD,
  PAGE_KEYS.USER_MANAGEMENT,
  PAGE_KEYS.PAGE_MANAGEMENT,
  PAGE_KEYS.COURIER_DELIVERED,
  PAGE_KEYS.COURIER_NOT_DELIVERED
] as const

export type MenuPageKey = (typeof MENU_PAGE_KEYS)[number]

/** İzin kontrolü gerektirmeyen sayfalar (her zaman erişilebilir; Ana Sayfa, Login) */
export const PUBLIC_PAGES: readonly PageKey[] = [PAGE_KEYS.DASHBOARD] as const

/**
 * İzin listesinde yer alan sayfalar (rol varsayılanları, atanabilir sayfalar).
 * Public sayfalar dahil edilmez; sadece izinle erişilen sayfalar.
 */
export const PAGES_REQUIRING_PERMISSION: readonly PageKey[] = [
  PAGE_KEYS.USER_MANAGEMENT,
  PAGE_KEYS.PAGE_MANAGEMENT,
  PAGE_KEYS.COURIER_DELIVERED,
  PAGE_KEYS.COURIER_NOT_DELIVERED
] as const

/** Sadece superadmin erişebilir */
export const SUPERADMIN_ONLY_PAGES: readonly PageKey[] = [
  PAGE_KEYS.USER_MANAGEMENT,
  PAGE_KEYS.SETTINGS,
  PAGE_KEYS.LOGS
] as const

/** HTTP benzeri durum kodları */
export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const

/** Varsayılan sayfalama */
export const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100
} as const
