// ============================================================
// Auth context tanımı - Fast Refresh için context ayrı dosyada
// authContext.ts yerine auth-context-def.ts kullanılıyor; çözümleyici
// ./AuthContext ile karışmasın diye.
// ============================================================

import { createContext } from 'react'
import type {
  UserWithoutPassword,
  PagePermission,
  LoginRequest,
  UserRole,
  RoleVisibilityDefault
} from '@shared/types'
import type { ServiceResponse } from '@shared/types'
import type { PageKey } from '@shared/utils'

// ---- State ----
export interface AuthState {
  user: UserWithoutPassword | null
  permissions: PagePermission[]
  /** Rol bazlı varsayılan görünürlük (kullanıcıya özel izin yoksa kullanılır) */
  roleVisibilityDefaults: RoleVisibilityDefault[]
  isAuthenticated: boolean
  isLoading: boolean
}

// ---- Actions ----
export type AuthAction =
  | { type: 'LOGIN_START' }
  | {
      type: 'LOGIN_SUCCESS'
      payload: {
        user: UserWithoutPassword
        permissions: PagePermission[]
        roleVisibilityDefaults: RoleVisibilityDefault[]
      }
    }
  | { type: 'LOGIN_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'UPDATE_PERMISSIONS'; payload: PagePermission[] }
  | { type: 'UPDATE_USER'; payload: UserWithoutPassword }
  | { type: 'UPDATE_ROLE_VISIBILITY_DEFAULTS'; payload: RoleVisibilityDefault[] }

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true }
    case 'LOGIN_SUCCESS':
      return {
        user: action.payload.user,
        permissions: action.payload.permissions,
        roleVisibilityDefaults: action.payload.roleVisibilityDefaults,
        isAuthenticated: true,
        isLoading: false
      }
    case 'LOGIN_FAILURE':
      return {
        user: null,
        permissions: [],
        roleVisibilityDefaults: [],
        isAuthenticated: false,
        isLoading: false
      }
    case 'LOGOUT':
      return {
        user: null,
        permissions: [],
        roleVisibilityDefaults: [],
        isAuthenticated: false,
        isLoading: false
      }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'UPDATE_PERMISSIONS':
      return { ...state, permissions: action.payload }
    case 'UPDATE_USER':
      return { ...state, user: action.payload }
    case 'UPDATE_ROLE_VISIBILITY_DEFAULTS':
      return { ...state, roleVisibilityDefaults: action.payload }
    default:
      return state
  }
}

export const initialState: AuthState = {
  user: null,
  permissions: [],
  roleVisibilityDefaults: [],
  isAuthenticated: false,
  isLoading: false
}

// ---- Context ----
export interface AuthContextValue {
  state: AuthState
  login: (data: LoginRequest) => Promise<ServiceResponse<unknown>>
  logout: () => void
  hasPageAccess: (pageKey: PageKey) => boolean
  hasMinimumRole: (role: UserRole) => boolean
  refreshPermissions: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
