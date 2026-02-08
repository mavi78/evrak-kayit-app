// ============================================================
// Route Tanımları - Tüm sayfalar ve yetkilendirme ayarları
// Hiyerarşik menü: children ile alt menüler (örn. Kurye işlemleri > Teslim edilen).
// ============================================================

import { lazy } from 'react'
import type { PageKey } from '@shared/utils'
import type { UserRole } from '@shared/types'

/** Route yapılandırma tipi; children ile alt menü grupları desteklenir */
export interface RouteConfig {
  /** URL yolu (grup için boş string) */
  path: string
  /** Sayfa bileşeni (lazy loaded); grup için tanımsız olabilir */
  component?: React.LazyExoticComponent<React.ComponentType>
  /** Sayfa anahtarı (izin kontrolü için; grupta ilk alt öğenin veya sanal anahtar) */
  pageKey: PageKey
  /** Sidebar'da gösterilsin mi? */
  showInSidebar: boolean
  /** Sidebar'da gösterilecek etiket */
  label: string
  /** Minimum rol seviyesi (opsiyonel) */
  minimumRole?: UserRole
  /** İzin kontrolü yapılsın mı? */
  requiresPermission: boolean
  /** Alt menü öğeleri (hiyerarşik menü) */
  children?: RouteConfig[]
}

// ---- Lazy loaded sayfa bileşenleri ----
const DashboardPage = lazy(() => import('@renderer/pages/dashboard/DashboardPage'))
const UserManagementPage = lazy(() => import('@renderer/pages/user-management/UserManagementPage'))
const CourierDeliveredPage = lazy(() => import('@renderer/pages/courier/CourierDeliveredPage'))
const CourierNotDeliveredPage = lazy(
  () => import('@renderer/pages/courier/CourierNotDeliveredPage')
)

/** Router'da kullanılan yaprak route (path + component zorunlu) */
export type LeafRouteConfig = RouteConfig & {
  path: string
  component: React.LazyExoticComponent<React.ComponentType>
}

/**
 * Ağaç yapısındaki route listesini router için düz listeye dönüştürür.
 * Sadece path ve component olan (yaprak) route'lar dahil edilir.
 */
export function flattenRoutes(configs: RouteConfig[]): LeafRouteConfig[] {
  const result: LeafRouteConfig[] = []
  for (const r of configs) {
    if (r.children?.length) {
      result.push(...flattenRoutes(r.children))
    } else if (r.path && r.component) {
      result.push(r as LeafRouteConfig)
    }
  }
  return result
}

// ============================================================
// ROUTE TANIMLARI (ağaç; sidebar hiyerarşik, router düz)
// ============================================================
export const routes: RouteConfig[] = [
  {
    path: '/dashboard',
    component: DashboardPage,
    pageKey: 'dashboard',
    showInSidebar: true,
    label: 'Ana Sayfa',
    requiresPermission: false
  },
  {
    path: '/user-management',
    component: UserManagementPage,
    pageKey: 'user-management',
    showInSidebar: true,
    label: 'Kullanıcı Yönetimi',
    minimumRole: 'admin',
    requiresPermission: false
  },
  {
    path: '',
    pageKey: 'courier-delivered',
    showInSidebar: true,
    label: 'Kurye işlemleri',
    requiresPermission: false,
    children: [
      {
        path: '/courier/delivered',
        component: CourierDeliveredPage,
        pageKey: 'courier-delivered',
        showInSidebar: true,
        label: 'Teslim edilen',
        requiresPermission: false
      },
      {
        path: '/courier/not-delivered',
        component: CourierNotDeliveredPage,
        pageKey: 'courier-not-delivered',
        showInSidebar: true,
        label: 'Teslim edilmeyen',
        requiresPermission: false
      }
    ]
  }
]

/** Router'da kullanılacak düz route listesi */
export const routesFlat = flattenRoutes(routes)
