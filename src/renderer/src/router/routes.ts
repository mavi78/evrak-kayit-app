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
const PageManagementPage = lazy(() => import('@renderer/pages/page-management/PageManagementPage'))
const CourierDeliveredPage = lazy(() => import('@renderer/pages/courier/CourierDeliveredPage'))
const CourierNotDeliveredPage = lazy(
  () => import('@renderer/pages/courier/CourierNotDeliveredPage')
)
const UnitsPage = lazy(() => import('@renderer/pages/settings/units/UnitsPage'))
const ClassificationsPage = lazy(
  () => import('@renderer/pages/settings/classifications/ClassificationsPage')
)
const ChannelsPage = lazy(() => import('@renderer/pages/settings/channels/ChannelsPage'))
const FoldersPage = lazy(() => import('@renderer/pages/settings/folders/FoldersPage'))
const CategoriesPage = lazy(() => import('@renderer/pages/settings/categories/CategoriesPage'))
const IncomingDocumentsPage = lazy(
  () => import('@renderer/pages/incoming-documents/IncomingDocumentsPage')
)
const AppSettingsPage = lazy(() => import('@renderer/pages/settings/app-general/AppSettingsPage'))
const PostalStampsPage = lazy(
  () => import('@renderer/pages/settings/postal-stamps/PostalStampsPage')
)
const PostalServicePage = lazy(() => import('@renderer/pages/postal-service/PostalServicePage'))

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
    path: '/incoming-documents',
    component: IncomingDocumentsPage,
    pageKey: 'incoming-documents',
    showInSidebar: true,
    label: 'Gelen Evrak',
    minimumRole: 'user',
    requiresPermission: true
  },
  {
    path: '/user-management',
    component: UserManagementPage,
    pageKey: 'user-management',
    showInSidebar: true,
    label: 'Kullanıcı Yönetimi',
    minimumRole: 'user',
    requiresPermission: true
  },
  {
    path: '/page-management',
    component: PageManagementPage,
    pageKey: 'page-management',
    showInSidebar: true,
    label: 'Sayfa Yönetimi',
    minimumRole: 'user',
    requiresPermission: true
  },
  {
    path: '',
    pageKey: 'settings-units',
    showInSidebar: true,
    label: 'Ayarlar',
    minimumRole: 'user',
    requiresPermission: true,
    children: [
      {
        path: '/settings/app-general',
        component: AppSettingsPage,
        pageKey: 'settings-app-general',
        showInSidebar: true,
        label: 'Genel Ayarlar',
        minimumRole: 'user',
        requiresPermission: true
      },
      {
        path: '/settings/units',
        component: UnitsPage,
        pageKey: 'settings-units',
        showInSidebar: true,
        label: 'Birlik Düzenleme',
        minimumRole: 'user',
        requiresPermission: true
      },
      {
        path: '/settings/classifications',
        component: ClassificationsPage,
        pageKey: 'settings-classifications',
        showInSidebar: true,
        label: 'Gizlilik Derecesi',
        minimumRole: 'user',
        requiresPermission: true
      },
      {
        path: '/settings/channels',
        component: ChannelsPage,
        pageKey: 'settings-channels',
        showInSidebar: true,
        label: 'Kanal Düzenleme',
        minimumRole: 'user',
        requiresPermission: true
      },
      {
        path: '/settings/folders',
        component: FoldersPage,
        pageKey: 'settings-folders',
        showInSidebar: true,
        label: 'Klasör Düzenleme',
        minimumRole: 'user',
        requiresPermission: true
      },
      {
        path: '/settings/categories',
        component: CategoriesPage,
        pageKey: 'settings-categories',
        showInSidebar: true,
        label: 'Kategori Düzenleme',
        minimumRole: 'user',
        requiresPermission: true
      },
      {
        path: '/settings/postal-stamps',
        component: PostalStampsPage,
        pageKey: 'settings-postal-stamps',
        showInSidebar: true,
        label: 'Posta Pulu',
        minimumRole: 'user',
        requiresPermission: true
      }
    ]
  },
  {
    path: '',
    pageKey: 'courier-delivered',
    showInSidebar: true,
    label: 'Kurye işlemleri',
    requiresPermission: true,
    children: [
      {
        path: '/courier/delivered',
        component: CourierDeliveredPage,
        pageKey: 'courier-delivered',
        showInSidebar: true,
        label: 'Teslim edilen',
        requiresPermission: true
      },
      {
        path: '/courier/not-delivered',
        component: CourierNotDeliveredPage,
        pageKey: 'courier-not-delivered',
        showInSidebar: true,
        label: 'Teslim edilmeyen',
        requiresPermission: true
      }
    ]
  },
  {
    path: '/postal-service',
    component: PostalServicePage,
    pageKey: 'postal-service',
    showInSidebar: true,
    label: 'Posta Servisi',
    minimumRole: 'user',
    requiresPermission: true
  }
]

/** Router'da kullanılacak düz route listesi */
export const routesFlat = flattenRoutes(routes)
