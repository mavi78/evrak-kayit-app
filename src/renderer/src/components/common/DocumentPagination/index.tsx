// ============================================================
// DocumentPagination - Evrak listeleri için sayfalandırma bileşeni
// Sayfa başına kayıt seçici, toplam bilgisi ve sayfa gezgini.
// Gelen, giden ve transit evrak sayfalarında yeniden kullanılır.
// ============================================================

import { Group, Text, Select, Pagination } from '@mantine/core'

const DEFAULT_PAGE_SIZE_OPTIONS = [
  { value: '20', label: '20' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: '200', label: '200' }
]

export interface DocumentPaginationProps {
  /** Mevcut sayfa numarası (1-tabanlı) */
  page: number
  /** Sayfa başına kayıt sayısı */
  pageSize: number
  /** Toplam kayıt sayısı */
  total: number
  /** Sayfa değiştiğinde çağrılır */
  onPageChange: (page: number) => void
  /** Sayfa boyutu değiştiğinde çağrılır */
  onPageSizeChange: (pageSize: number) => void
  /** Sayfa boyutu seçenekleri (opsiyonel) */
  pageSizeOptions?: { value: string; label: string }[]
}

/**
 * Evrak listeleri için sayfalandırma bileşeni.
 * total > 0 olduğunda gösterilmelidir.
 */
export function DocumentPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS
}: DocumentPaginationProps): React.JSX.Element | null {
  if (total <= 0) return null

  return (
    <Group justify="space-between" mt="xs" wrap="wrap" gap="xs">
      <Group gap="xs" align="center">
        <Text size="xs" c="dimmed">
          Sayfa başına:
        </Text>
        <Select
          size="xs"
          w={70}
          data={pageSizeOptions}
          value={String(pageSize)}
          onChange={(v) => {
            const newSize = v ? parseInt(v, 10) : 20
            onPageSizeChange(newSize)
          }}
        />
        <Text size="xs" c="dimmed">
          Toplam: {total}
        </Text>
      </Group>
      <Pagination
        size="xs"
        value={page}
        onChange={onPageChange}
        total={Math.ceil(total / pageSize) || 1}
        siblings={1}
        boundaries={1}
      />
    </Group>
  )
}
