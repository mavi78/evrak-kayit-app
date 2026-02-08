// ============================================================
// ProtectedRoute - Yetkilendirme kontrolü yapan sarmalayıcı
// Neden: Her sayfa için ayrı yetki kontrolü yazmak yerine
// merkezi bir kontrol noktası sağlar.
// ============================================================

import { Navigate } from 'react-router-dom'
import { useAuth } from '@renderer/hooks/useAuth'
import type { RouteConfig } from './routes'

const CHANGE_PASSWORD_PATH = '/change-password'

interface ProtectedRouteProps {
  route: RouteConfig
  children: React.ReactNode
}

export function ProtectedRoute({ route, children }: ProtectedRouteProps): React.JSX.Element {
  const { state, hasPageAccess, hasMinimumRole } = useAuth()

  // Giriş yapmamışsa login sayfasına yönlendir
  if (!state.isAuthenticated || !state.user) {
    return <Navigate to="/login" replace />
  }

  // Şifre değiştirme zorunluysa sadece /change-password sayfasına izin ver
  if (state.user.must_change_password && route.path !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />
  }

  // Zorunlu şifre sayfasındaysa rol/izin kontrolü yapma
  if (route.path === CHANGE_PASSWORD_PATH) {
    return <>{children}</>
  }

  // Minimum rol kontrolü
  if (route.minimumRole && !hasMinimumRole(route.minimumRole)) {
    return <Navigate to="/dashboard" replace />
  }

  // Sayfa izin kontrolü
  if (route.requiresPermission && !hasPageAccess(route.pageKey)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
