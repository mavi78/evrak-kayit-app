// ============================================================
// Context barrel - AuthProvider ve AuthContext tek giriş noktası
// Çözümleyicinin AuthContext ile authContext karıştırmasını önler.
// ============================================================

export { AuthProvider } from './AuthContext'
export {
  AuthContext,
  authReducer,
  initialState,
  type AuthContextValue,
  type AuthState,
  type AuthAction
} from './auth-context-def'
