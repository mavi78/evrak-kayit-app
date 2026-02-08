// ============================================================
// useAuth Hook - AuthContext'e kolay erişim
// Neden: Her bileşende useContext + null check yazmak yerine
// tek bir hook ile temiz erişim sağlanır.
// ============================================================

import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from '@renderer/context'

/**
 * AuthContext'e kolay erişim sağlayan hook.
 * AuthProvider dışında kullanıldığında hata fırlatır.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth hook, AuthProvider içinde kullanılmalıdır')
  }
  return context
}
