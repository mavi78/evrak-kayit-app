import { useState, useCallback, type MouseEvent } from 'react'

/** Bağlam menüsü konumu ve satır verisi */
export interface ContextMenuState<T> {
  /** Mouse X koordinatı (clientX) */
  x: number
  /** Mouse Y koordinatı (clientY) */
  y: number
  /** Sağ tıklanan satır verisi */
  row: T
}

/**
 * Bağlam menüsü state yönetimi için custom hook.
 * Sayfa bileşenlerinde tekrar eden state + handler kalıbını ortadan kaldırır.
 */
export function useDocumentContextMenu<T>(): {
  contextMenu: ContextMenuState<T> | null
  openContextMenu: (row: T, event: MouseEvent) => void
  closeContextMenu: () => void
} {
  const [contextMenu, setContextMenu] = useState<ContextMenuState<T> | null>(null)

  const openContextMenu = useCallback((row: T, event: MouseEvent): void => {
    setContextMenu({ x: event.clientX, y: event.clientY, row })
  }, [])

  const closeContextMenu = useCallback((): void => {
    setContextMenu(null)
  }, [])

  return { contextMenu, openContextMenu, closeContextMenu }
}
