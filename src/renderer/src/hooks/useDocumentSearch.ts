// ============================================================
// useDocumentSearch - Evrak araması (K.No + genel) debounce hook
// K.No her değişimde; genel arama minChars sonrası tetiklenir.
// ============================================================

import { useEffect, useRef } from 'react'

export interface DocumentSearchParams {
  recordNo?: number
  query?: string
}

export interface UseDocumentSearchOptions {
  /** K.No input değeri (sadece rakam) */
  recordNoValue: string
  /** Genel arama sorgusu */
  query: string
  /** Genel arama için min karakter (K.No bundan muaf) */
  minChars?: number
  /** Debounce süresi (ms) */
  debounceMs?: number
  /** Her iki alan da boşken çağrılır */
  onEmptySearch: () => void
  /** Arama tetiklenince (recordNo ve/veya query ile) */
  onSearch: (params: DocumentSearchParams) => void
}

/**
 * K.No veya genel arama değişince debounce ile onSearch çağrılır.
 * K.No doluysa hemen aranır; genel arama minChars sonrası.
 */
export function useDocumentSearch({
  recordNoValue,
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

    const rn = recordNoValue.trim()
    const q = query.trim()
    const recordNo = rn ? parseInt(rn, 10) : undefined
    const hasRecordNo = rn.length > 0 && !Number.isNaN(recordNo!)
    const hasValidQuery = q.length >= minChars

    if (!hasRecordNo && !hasValidQuery) {
      if (rn.length === 0 && q.length === 0) {
        onEmptySearch()
      }
      return
    }

    timeoutRef.current = setTimeout(() => {
      onSearch({
        recordNo: hasRecordNo ? recordNo : undefined,
        query: q || undefined
      })
      timeoutRef.current = null
    }, debounceMs)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [recordNoValue, query, minChars, debounceMs, onEmptySearch, onSearch])
}
