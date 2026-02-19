// ============================================================
// useDocumentSearch - Evrak araması (K.No (id) + genel) debounce hook
// K.No her değişimde; genel arama minChars sonrası tetiklenir.
// ============================================================

import { useEffect, useRef } from 'react'

export interface DocumentSearchParams {
  id?: number
  query?: string
}

export interface UseDocumentSearchOptions {
  /** K.No (id) input değeri (sadece rakam) */
  idValue: string
  /** Genel arama sorgusu */
  query: string
  /** Genel arama için min karakter (K.No bundan muaf) */
  minChars?: number
  /** Debounce süresi (ms) */
  debounceMs?: number
  /** Her iki alan da boşken çağrılır */
  onEmptySearch: () => void
  /** Arama tetiklenince (id ve/veya query ile) */
  onSearch: (params: DocumentSearchParams) => void
}

/**
 * K.No (id) veya genel arama değişince debounce ile onSearch çağrılır.
 * K.No doluysa hemen aranır; genel arama minChars sonrası.
 */
export function useDocumentSearch({
  idValue,
  query,
  minChars = 3,
  debounceMs = 300,
  onEmptySearch,
  onSearch
}: UseDocumentSearchOptions): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const rn = idValue.trim()
    const q = query.trim()
    const id = rn ? parseInt(rn, 10) : undefined
    const hasId = rn.length > 0 && !Number.isNaN(id!)
    const hasValidQuery = q.length >= minChars

    if (!hasId && !hasValidQuery) {
      if (rn.length === 0 && q.length === 0) {
        onEmptySearch()
      }
      return
    }

    timeoutRef.current = setTimeout(() => {
      onSearch({
        id: hasId ? id : undefined,
        query: q || undefined
      })
      timeoutRef.current = null
    }, debounceMs)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [idValue, query, minChars, debounceMs, onEmptySearch, onSearch])
}
