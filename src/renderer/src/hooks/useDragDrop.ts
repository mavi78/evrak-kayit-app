// ============================================================
// useDragDrop - Ortak drag & drop hook'u
//
// Sorumlulukları:
// 1. HTML5 drag & drop API ile pozisyon algılama
// 2. Hiyerarşik ve basit sıralama desteği
// 3. Drop target görsel geri bildirimi
// ============================================================

import { useState, useCallback } from 'react'

export type DropTarget = 'child' | 'sibling-before' | 'sibling-after' | null

export interface DragDropPosition {
  isOnTop: boolean
  isAbove: boolean
}

/**
 * Mouse pozisyonuna göre drop target pozisyonunu hesaplar
 * @param mouseY - Mouse'un Y pozisyonu (clientY)
 * @param overRect - Over elementinin bounding rect'i
 * @returns Drop target pozisyonu bilgisi
 */
export function calculateDropPosition(mouseY: number, overRect: DOMRect): DragDropPosition {
  const overTop = overRect.top
  const overHeight = overRect.height
  const topThreshold = overTop + overHeight * 0.35
  const bottomThreshold = overTop + overHeight * 0.65

  if (mouseY < topThreshold) {
    // Üst %35'e geldi - "üstüne" (sıralama)
    return { isOnTop: false, isAbove: true }
  } else if (mouseY > bottomThreshold) {
    // Alt %35'e geldi - "altına" (sıralama)
    return { isOnTop: false, isAbove: false }
  } else {
    // Ortadaki %30'a geldi - "tam üzerine" (alt birliği)
    return { isOnTop: true, isAbove: false }
  }
}

/**
 * Drop target tipini hesaplar (görsel geri bildirim için)
 * @param position - Pozisyon bilgisi
 * @param sameParent - Aynı parent'a mı aitler?
 * @returns Drop target tipi
 */
export function calculateDropTarget(position: DragDropPosition, sameParent: boolean): DropTarget {
  if (sameParent) {
    // Aynı seviyede: pozisyona göre sıralama veya alt birliği
    if (position.isOnTop) {
      return 'child'
    } else if (position.isAbove) {
      return 'sibling-before'
    } else {
      return 'sibling-after'
    }
  } else {
    // Farklı seviye: pozisyona göre alt birliği veya üst birliğe taşıma
    if (position.isOnTop) {
      return 'child'
    } else {
      return position.isAbove ? 'sibling-before' : 'sibling-after'
    }
  }
}

export interface UseDragDropOptions<T> {
  /**
   * İki item'ın aynı parent'a ait olup olmadığını kontrol eden fonksiyon
   */
  isSameParent: (active: T, over: T) => boolean
}

export interface UseDragDropReturn {
  /**
   * Aktif olarak sürüklenen item'ın ID'si
   */
  draggingId: number | null
  /**
   * Drop target bilgileri (görsel geri bildirim için)
   */
  dropTarget: Map<number, DropTarget>
  /**
   * Drag başladığında çağrılır
   */
  handleDragStart: (e: React.DragEvent, itemId: number) => void
  /**
   * Drag over sırasında çağrılır (pozisyon algılama için)
   */
  handleDragOver: (e: React.DragEvent, overId: number) => void
  /**
   * Drag bittiğinde çağrılır
   */
  handleDragEnd: () => void
  /**
   * Drop pozisyonunu hesaplar ve döndürür
   */
  calculatePosition: (e: React.DragEvent, overId: number) => DragDropPosition | null
  /**
   * Drop target'ı manuel olarak günceller (sameParent bilgisiyle override için)
   */
  updateDropTarget: (overId: number, target: DropTarget) => void
}

/**
 * Drag & drop işlemleri için ortak hook
 * @param options - Hook seçenekleri
 * @returns Drag & drop state ve handler'ları
 */
export function useDragDrop<T extends { id: number }>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: UseDragDropOptions<T>
): UseDragDropReturn {
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<Map<number, DropTarget>>(new Map())

  const handleDragStart = useCallback((e: React.DragEvent, itemId: number): void => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(itemId))
    setDraggingId(itemId)
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent, overId: number): void => {
      e.preventDefault()
      e.stopPropagation()

      if (!draggingId || draggingId === overId) {
        setDropTarget(new Map())
        return
      }

      // Bu hook sadece görsel geri bildirim için kullanılır
      // Gerçek drop mantığı sayfa component'inde olacak
      const mouseY = e.clientY
      const overElement = e.currentTarget as HTMLElement
      const overRect = overElement.getBoundingClientRect()

      const position = calculateDropPosition(mouseY, overRect)
      // Same parent kontrolü için items'a ihtiyaç var ama bu hook'ta yok
      // Bu yüzden sadece pozisyona göre drop target hesaplıyoruz
      // Sayfa component'inde sameParent kontrolü yapılacak
      const target: DropTarget = position.isOnTop
        ? 'child'
        : position.isAbove
          ? 'sibling-before'
          : 'sibling-after'

      const newDropTarget = new Map<number, DropTarget>()
      newDropTarget.set(overId, target)
      setDropTarget(newDropTarget)
    },
    [draggingId]
  )

  const handleDragEnd = useCallback((): void => {
    setDropTarget(new Map())
    setDraggingId(null)
  }, [])

  const calculatePosition = useCallback(
    (e: React.DragEvent, overId: number): DragDropPosition | null => {
      if (!draggingId || draggingId === overId) return null

      const mouseY = e.clientY
      const overElement = e.currentTarget as HTMLElement
      const overRect = overElement.getBoundingClientRect()

      return calculateDropPosition(mouseY, overRect)
    },
    [draggingId]
  )

  const updateDropTarget = useCallback((overId: number, target: DropTarget): void => {
    const newDropTarget = new Map<number, DropTarget>()
    newDropTarget.set(overId, target)
    setDropTarget(newDropTarget)
  }, [])

  return {
    draggingId,
    dropTarget,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    calculatePosition,
    updateDropTarget
  }
}
