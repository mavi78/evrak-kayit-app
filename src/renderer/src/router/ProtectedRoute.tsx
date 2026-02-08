// ============================================================
// ProtectedRoute - Yetkilendirme kontrolü yapan sarmalayıcı
// Neden: Her sayfa için ayrı yetki kontrolü yazmak yerine
// merkezi bir kontrol noktası sağlar.
// ============================================================

import { Navigate } from 'react-router-dom'
import { useAuth } from '@renderer/hooks/useAuth'
import type { RouteConfig } from './routes'

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
