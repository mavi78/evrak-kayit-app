// ============================================================
// Router - Uygulama yönlendirme yapılandırması
// Login dahil tüm sayfalar AppLayout içinde (header + arka plan); sidebar sadece giriş yapılmışken.
// Kimliği doğrulanmamışken * ile dashboard'a gitmez, doğrudan /login'e yönlendirilir.
// ============================================================

import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Box, Center, Loader } from '@mantine/core'
import { routesFlat } from './routes'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuth } from '@renderer/hooks/useAuth'
import { AppLayout } from '@renderer/components/layout/AppLayout'
import LoginPage from '@renderer/pages/login/LoginPage'

const ChangePasswordPage = lazy(() => import('@renderer/pages/change-password/ChangePasswordPage'))

/** Sayfa yüklenirken gösterilecek loading bileşeni */
function PageLoader(): React.JSX.Element {
  return (
    <Center h="100%">
      <Loader size="lg" type="dots" />
    </Center>
  )
}

/** Auth durumuna göre yönlendirme — giriş yoksa login; şifre zorunluysa /change-password */
function AuthAwareRedirect(): React.JSX.Element {
  const { state } = useAuth()
  if (!state.isAuthenticated || !state.user) return <Navigate to="/login" replace />
  if (state.user.must_change_password) return <Navigate to="/change-password" replace />
  return <Navigate to="/dashboard" replace />
}

export function AppRouter(): React.JSX.Element {
  const { state } = useAuth()

  return (
    <Box
      style={{
        height: '100%',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Routes>
        {/* Tüm sayfalar aynı layout altında: header + arka plan; sidebar sadece giriş yapılmışken */}
        <Route element={<AppLayout />}>
          {/* Giriş sayfası — giriş sonrası şifre zorunluysa /change-password, değilse /dashboard */}
          <Route
            path="/login"
            element={
              state.isAuthenticated && state.user ? (
                state.user.must_change_password ? (
                  <Navigate to="/change-password" replace />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              ) : (
                <LoginPage />
              )
            }
          />

          {/* Zorunlu şifre değiştirme — must_change_password true iken tek erişilebilir sayfa */}
          <Route
            path="/change-password"
            element={
              <ProtectedRoute
                route={{
                  path: '/change-password',
                  pageKey: 'dashboard',
                  showInSidebar: false,
                  label: '',
                  requiresPermission: false
                }}
              >
                <Suspense fallback={<PageLoader />}>
                  <ChangePasswordPage />
                </Suspense>
              </ProtectedRoute>
            }
          />

          {/* Korumalı sayfalar */}
          {routesFlat.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <ProtectedRoute route={route}>
                  <Suspense fallback={<PageLoader />}>
                    <route.component />
                  </Suspense>
                </ProtectedRoute>
              }
            />
          ))}

          {/* Bilinmeyen / kök: giriş yoksa login, giriş varsa dashboard */}
          <Route path="*" element={<AuthAwareRedirect />} />
        </Route>
      </Routes>
    </Box>
  )
}
