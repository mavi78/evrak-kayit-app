// ============================================================
// DocumentTable - Evrak listeleri için genel tablo bileşeni
// Gelen, giden ve transit evrak sayfalarında yeniden kullanılır.
// Modern, temiz tasarım: sticky header, yumuşak hover, minimal çerçeve.
// ============================================================

import { Table, Loader, Center, Text, ScrollArea, Paper } from '@mantine/core'

/** Sütun tanımı — key ile veri erişimi, render ile özelleştirilmiş görünüm */
export interface DocumentTableColumn<T> {
  /** Sütun anahtarı (row[key] için) */
  key: string
  /** Tablo başlığı (string veya ReactNode — çok satırlı başlık için) */
  label: React.ReactNode
  /** Hücre içeriğini özelleştirir (yoksa row[key] gösterilir) */
  render?: (row: T) => React.ReactNode
  /** Sütun genişliği (örn. '6ch', 80) */
  width?: string | number
  /** Minimum genişlik (örn. '6ch' — GÜV için en az 6 karakter) */
  minWidth?: string | number
  /** Hücre metninin satır kırmasını engeller (GÜV için) */
  noWrap?: boolean
  /** Hücre içeriği hizası (varsayılan: center) */
  align?: 'left' | 'center'
}

export interface DocumentTableProps<T> {
  /** Sütun tanımları */
  columns: DocumentTableColumn<T>[]
  /** Tablo verisi */
  data: T[]
  /** Yükleme durumu */
  loading?: boolean
  /** Satır tıklanınca çağrılır (form/detay açma için) */
  onRowClick?: (row: T) => void
  /** Satır çift tıklanınca çağrılır (düzenleme vb. için) */
  onRowDoubleClick?: (row: T) => void
  /** Veri yokken gösterilecek mesaj */
  emptyMessage?: string
  /** Seçili satırın id'si — vurgulanır, tek satır seçimi */
  selectedRowId?: number
  /** ScrollArea viewport ref — scroll pozisyonunu korumak için */
  viewportRef?: React.RefObject<HTMLDivElement | null>
}

/**
 * Evrak listeleri için genel tablo bileşeni.
 * Gelen, giden ve transit evrak sayfalarında kullanılır.
 */
export function DocumentTable<T extends object>({
  columns,
  data,
  loading = false,
  onRowClick,
  onRowDoubleClick,
  emptyMessage = 'Henüz kayıt yok.',
  selectedRowId,
  viewportRef
}: DocumentTableProps<T>): React.JSX.Element {
  if (loading) {
    return (
      <Center py={80}>
        <Loader size="md" type="dots" />
      </Center>
    )
  }

  if (data.length === 0) {
    return (
      <Center py={80}>
        <Text size="sm" c="dimmed">
          {emptyMessage}
        </Text>
      </Center>
    )
  }

  return (
    <Paper
      radius="md"
      shadow="sm"
      withBorder
      style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}
    >
      <ScrollArea style={{ flex: 1 }} scrollbarSize={6} type="hover" viewportRef={viewportRef}>
        <Table
          stickyHeader
          striped
          highlightOnHover
          fz="xs"
          styles={{
            table: {
              borderCollapse: 'separate',
              borderSpacing: 0
            },
            thead: {
              background:
                'linear-gradient(180deg, var(--mantine-color-deniz-4) 0%, var(--mantine-color-deniz-6) 50%, var(--mantine-color-deniz-8) 100%)',
              boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.12)',
              borderBottom: '1px solid var(--mantine-color-deniz-7)'
            },
            th: {
              padding: '4px 8px',
              fontWeight: 800,
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--mantine-color-deniz-0)',
              background:
                'linear-gradient(180deg, var(--mantine-color-deniz-4) 0%, var(--mantine-color-deniz-6) 50%, var(--mantine-color-deniz-8) 100%)',
              borderBottom: 'none'
            },
            td: {
              padding: '4px 8px',
              fontSize: '0.75rem',
              borderBottom: '1px solid var(--mantine-color-default-border)',
              transition: 'background-color 150ms ease'
            },
            tr: {
              cursor: onRowClick || onRowDoubleClick ? 'pointer' : undefined
            }
          }}
        >
          <Table.Thead>
            <Table.Tr>
              {columns.map((col, idx) => (
                <Table.Th
                  key={col.key}
                  style={{
                    textAlign: 'center',
                    width: col.width,
                    minWidth: col.minWidth,
                    whiteSpace: col.noWrap ? 'nowrap' : undefined,
                    borderTopLeftRadius: idx === 0 ? 'var(--mantine-radius-md)' : undefined,
                    borderTopRightRadius:
                      idx === columns.length - 1 ? 'var(--mantine-radius-md)' : undefined
                  }}
                >
                  {col.label}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((row, rowIdx) => {
              const rowId = (row as { id?: number }).id
              const isSelected = selectedRowId != null && rowId === selectedRowId
              return (
                <Table.Tr
                  key={rowId ?? rowIdx}
                  onClick={() => onRowClick?.(row)}
                  onDoubleClick={() => onRowDoubleClick?.(row)}
                  tabIndex={onRowClick || onRowDoubleClick ? 0 : undefined}
                  aria-selected={isSelected}
                  aria-current={isSelected ? 'true' : undefined}
                  role="row"
                  data-selected={isSelected || undefined}
                  bg={isSelected ? 'var(--mantine-color-deniz-0)' : undefined}
                  style={
                    isSelected
                      ? {
                          borderLeft: '3px solid var(--mantine-color-deniz-6)',
                          fontWeight: 500,
                          userSelect: 'none'
                        }
                      : { userSelect: 'none' }
                  }
                >
                  {columns.map((col, colIdx) => (
                    <Table.Td
                      key={col.key}
                      style={{
                        width: col.width,
                        minWidth: col.minWidth,
                        whiteSpace: col.noWrap ? 'nowrap' : undefined,
                        textAlign: col.align ?? 'center',
                        borderBottomLeftRadius:
                          rowIdx === data.length - 1 && colIdx === 0
                            ? 'var(--mantine-radius-md)'
                            : undefined,
                        borderBottomRightRadius:
                          rowIdx === data.length - 1 && colIdx === columns.length - 1
                            ? 'var(--mantine-radius-md)'
                            : undefined
                      }}
                    >
                      {col.render
                        ? col.render(row)
                        : (((row as Record<string, unknown>)[col.key] as React.ReactNode) ?? '—')}
                    </Table.Td>
                  ))}
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Paper>
  )
}
