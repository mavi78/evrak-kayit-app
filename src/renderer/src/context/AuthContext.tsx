// ============================================================
// Auth Context - Uygulama genelinde kullanıcı durumu yönetimi
// Context tanımı authContext.ts'de (Fast Refresh uyumu).
// ============================================================

import { useReducer, useCallback, type ReactNode } from 'react'
import { authApi } from '@renderer/lib/api'
import { AuthContext, authReducer, initialState, type AuthContextValue } from './auth-context-def'
import { PUBLIC_PAGES, SUPERADMIN_ONLY_PAGES, type PageKey } from '@shared/utils'
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
          permissions: response.data.permissions
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
      if (state.user.role === 'superadmin') return true
      if (PUBLIC_PAGES.includes(pageKey)) return true
      if (SUPERADMIN_ONLY_PAGES.includes(pageKey)) return false
      const permission = state.permissions.find((p) => p.page_key === pageKey)
      return permission?.can_access ?? false
    },
    [state.user, state.permissions]
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
