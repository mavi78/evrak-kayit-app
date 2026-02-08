// ============================================================
// Auth Context - Uygulama genelinde kullanıcı durumu yönetimi
// Context tanımı authContext.ts'de (Fast Refresh uyumu).
// ============================================================

import { useReducer, useCallback, type ReactNode } from 'react'
import { authApi } from '@renderer/lib/api'
import { AuthContext, authReducer, initialState, type AuthContextValue } from './auth-context-def'
import { PUBLIC_PAGES, type PageKey } from '@shared/utils'
import { ROLE_HIERARCHY, type LoginRequest, type UserRole } from '@shared/types'

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, dispatch] = useReducer(authReducer, initialState)

  const login = useCallback(async (data: LoginRequest) => {
    dispatch({ type: 'LOGIN_START' })
    const response = await authApi.login(data)
    if (response.success && response.data) {
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user: response.data.user,
          permissions: response.data.permissions,
          roleVisibilityDefaults: response.data.role_visibility_defaults ?? []
        }
      })
    } else {
      dispatch({ type: 'LOGIN_FAILURE' })
    }
    return response
  }, [])

  const logout = useCallback((): void => {
    dispatch({ type: 'LOGOUT' })
  }, [])

  const hasPageAccess = useCallback(
    (pageKey: PageKey): boolean => {
      if (!state.user) return false

      // system: tüm sayfalara erişir
      if (state.user.role === 'system') return true

      // Public sayfalar: sadece Ana Sayfa ve Login (login route'ta ayrı; burada dashboard)
      if (PUBLIC_PAGES.includes(pageKey)) return true

      // İzinler sadece rol bazlı: backend role_page_defaults + role_visibility_defaults birleşimi döner
      const roleDefault = state.roleVisibilityDefaults.find((r) => r.page_key === pageKey)
      if (roleDefault !== undefined) return roleDefault.can_access

      return false
    },
    [state.user, state.roleVisibilityDefaults]
  )

  const hasMinimumRole = useCallback(
    (role: UserRole): boolean => {
      if (!state.user) return false
      return ROLE_HIERARCHY[state.user.role] >= ROLE_HIERARCHY[role]
    },
    [state.user]
  )

  const refreshPermissions = useCallback(async (): Promise<void> => {
    if (!state.user) return
    const response = await authApi.getCurrentUser(state.user.id)
    if (response.success && response.data) {
      dispatch({ type: 'UPDATE_PERMISSIONS', payload: response.data.permissions })
      dispatch({ type: 'UPDATE_USER', payload: response.data.user })
      dispatch({
        type: 'UPDATE_ROLE_VISIBILITY_DEFAULTS',
        payload: response.data.role_visibility_defaults ?? []
      })
    }
  }, [state.user])

  const value: AuthContextValue = {
    state,
    login,
    logout,
    hasPageAccess,
    hasMinimumRole,
    refreshPermissions
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
