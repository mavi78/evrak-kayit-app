// ============================================================
// DistributionTable - Havale/dağıtım listesi (en fazla 4 satır yükseklik)
// BİRLİK ADI, DAĞITIM ŞEKLİ, TESLİM TARİHİ, SENET NO
// ============================================================

import { Table, Text, ScrollArea } from '@mantine/core'
import type { IncomingDocumentDistribution, Unit } from '@shared/types'

export interface DistributionTableProps {
  distributions: IncomingDocumentDistribution[]
  units: Unit[]
}

/**
 * Seçili evrakın havale/dağıtım listesini gösterir.
 * Maksimum 4 satır yüksekliğinde, sayfa altında sabit kart içinde.
 */
export function DistributionTable({
  distributions,
  units
}: DistributionTableProps): React.JSX.Element {
  const getUnitName = (unitId: number): string => {
    const u = units.find((x) => x.id === unitId)
    return u?.short_name ?? u?.name ?? String(unitId)
  }

  if (distributions.length === 0) {
    return (
      <Text size="sm" c="dimmed" py="md" ta="center">
        Dağıtım kaydı yok.
      </Text>
    )
  }

  return (
    <ScrollArea
      h={130}
      scrollbarSize={4}
      type="hover"
      styles={{ viewport: { overflowX: 'hidden' } }}
    >
      <Table
        stickyHeader
        striped
        highlightOnHover
        fz="xs"
        styles={{
          table: { borderCollapse: 'separate', borderSpacing: 0 },
          thead: {
            background:
              'linear-gradient(180deg, var(--mantine-color-deniz-4) 0%, var(--mantine-color-deniz-6) 50%, var(--mantine-color-deniz-8) 100%)',
            boxShadow:
              'inset 0 1px 0 0 rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.1)',
            borderBottom: '1px solid var(--mantine-color-deniz-7)'
          },
          th: {
            padding: '4px 8px',
            fontWeight: 800,
            fontSize: '0.68rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--mantine-color-deniz-0)',
            background:
              'linear-gradient(180deg, var(--mantine-color-deniz-4) 0%, var(--mantine-color-deniz-6) 50%, var(--mantine-color-deniz-8) 100%)',
            borderBottom: 'none'
          },
          td: {
            padding: '4px 8px',
            fontSize: '0.72rem'
          }
        }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ textAlign: 'center', borderTopLeftRadius: 'var(--mantine-radius-sm)' }}>
              BİRLİK ADI
            </Table.Th>
            <Table.Th style={{ textAlign: 'center' }}>DAĞITIM ŞEKLİ</Table.Th>
            <Table.Th style={{ textAlign: 'center' }}>TESLİM TARİHİ</Table.Th>
            <Table.Th
              style={{
                textAlign: 'center',
                borderTopRightRadius: 'var(--mantine-radius-sm)'
              }}
            >
              SENET NO
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {distributions.map((d) => (
            <Table.Tr key={d.id}>
              <Table.Td style={{ textAlign: 'left' }}>{getUnitName(d.unit_id)}</Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>{d.distribution_type || '—'}</Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>{d.delivery_date || '—'}</Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>{d.receipt_no || '—'}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  )
}
