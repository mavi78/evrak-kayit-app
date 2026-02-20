// ============================================================
// ReceiptPrintView - Senet yazdırma bileşeni (Modal + Print)
//
// A4 yatay (landscape) formatta senet çıktısı:
// - Teslim edilen evrak listesi tablosu
// - Senet no, evrak bilgileri, birlik, imza alanları
// - @media print ile sadece senet alanı yazdırılır
// ============================================================

import { useCallback, useRef } from 'react'
import { Modal, Box, Button, Group, Table, Text, Stack, Divider } from '@mantine/core'
import { IconPrinter, IconX } from '@tabler/icons-react'
import type { DeliveredReceiptInfo, Classification } from '@shared/types'

interface ReceiptPrintViewProps {
  data: DeliveredReceiptInfo[]
  classifications: Classification[]
  onClose: () => void
}

/** Tarih formatlama: YYYY-MM-DD → DD.MM.YYYY */
function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const parts = dateStr.split(/[- ]/)
  if (parts.length >= 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`
  }
  return dateStr
}

/** Teslim tarihi formatlama: YYYY-MM-DD HH:mm:ss → DD.MM.YYYY HH:mm */
function formatDeliveryDate(dateStr: string): string {
  if (!dateStr) return '—'
  const parts = dateStr.split(' ')
  const datePart = formatDate(parts[0])
  const timePart = parts[1] ? parts[1].substring(0, 5) : ''
  return timePart ? `${datePart} ${timePart}` : datePart
}

export function ReceiptPrintView({
  data,
  classifications,
  onClose
}: ReceiptPrintViewProps): React.JSX.Element {
  const printRef = useRef<HTMLDivElement>(null)

  const getClassificationName = useCallback(
    (classId: number): string => {
      const c = classifications.find((x) => x.id === classId)
      return c?.name ?? ''
    },
    [classifications]
  )

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  // Bugünün tarihi
  const today = new Date()
  const todayStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`

  return (
    <Modal
      opened
      onClose={onClose}
      size="90vw"
      title="Senet Önizleme"
      centered
      styles={{
        body: { padding: 0 },
        header: { padding: '8px 16px' }
      }}
    >
      {/* Yazdırma butonları — ekranda görünür, printde gizli */}
      <Group
        justify="flex-end"
        p="sm"
        className="no-print"
        style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Button
          leftSection={<IconPrinter size={16} />}
          onClick={handlePrint}
          color="teal"
          size="sm"
        >
          Yazdır
        </Button>
        <Button
          leftSection={<IconX size={16} />}
          onClick={onClose}
          variant="light"
          color="gray"
          size="sm"
        >
          Kapat
        </Button>
      </Group>

      {/* Yazdırılacak alan */}
      <Box ref={printRef} className="print-area" p="md">
        {/* Başlık */}
        <Stack gap={2} align="center" mb="md">
          <Text fw={800} size="lg" tt="uppercase">
            BELGE TESLİM SENEDİ
          </Text>
          <Text size="sm" c="dimmed">
            Tarih: {todayStr}
          </Text>
        </Stack>

        <Divider mb="sm" />

        {/* Evrak Tablosu */}
        <Table
          withTableBorder
          withColumnBorders
          fz="xs"
          styles={{
            table: { borderCollapse: 'collapse' },
            th: {
              padding: '4px 6px',
              fontWeight: 700,
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              background: '#f1f3f5',
              textAlign: 'center',
              whiteSpace: 'nowrap'
            },
            td: {
              padding: '3px 6px',
              fontSize: '0.68rem'
            }
          }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 30 }}>S.NO</Table.Th>
              <Table.Th style={{ width: 50 }}>SENET NO</Table.Th>
              <Table.Th style={{ width: 50 }}>K.NO</Table.Th>
              <Table.Th>MAKAM</Table.Th>
              <Table.Th>SAYI</Table.Th>
              <Table.Th style={{ minWidth: 140 }}>KONU</Table.Th>
              <Table.Th style={{ width: 80 }}>TARİHİ</Table.Th>
              <Table.Th>BİRLİK</Table.Th>
              <Table.Th style={{ width: 70 }}>GİZLİLİK</Table.Th>
              <Table.Th style={{ width: 50 }}>GÜV.K.NO</Table.Th>
              <Table.Th style={{ width: 30 }}>EK</Table.Th>
              <Table.Th style={{ width: 30 }}>SYF</Table.Th>
              <Table.Th style={{ width: 90 }}>TESLİM TARİHİ</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((item, idx) => (
              <Table.Tr key={item.distribution_id}>
                <Table.Td style={{ textAlign: 'center' }}>{idx + 1}</Table.Td>
                <Table.Td fw={700} style={{ textAlign: 'center' }}>
                  {item.receipt_no ?? '—'}
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>{item.document_id}</Table.Td>
                <Table.Td>{item.source_office}</Table.Td>
                <Table.Td>{item.reference_number}</Table.Td>
                <Table.Td>{item.subject}</Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  {formatDate(item.document_date)}
                </Table.Td>
                <Table.Td>{item.unit_name}</Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  {getClassificationName(item.classification_id)}
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  {item.security_control_no || '—'}
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>{item.attachment_count}</Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>{item.page_count}</Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  {formatDeliveryDate(item.delivery_date)}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {/* İmza Alanları */}
        <Group justify="space-between" mt={60} px="xl">
          <Stack gap={4} align="center">
            <Text size="xs" fw={600} tt="uppercase">
              TESLİM EDEN
            </Text>
            <Box style={{ width: 200, borderBottom: '1px solid #000', marginTop: 40 }} />
            <Text size="xs" c="dimmed">
              Ad Soyad / İmza
            </Text>
          </Stack>
          <Stack gap={4} align="center">
            <Text size="xs" fw={600} tt="uppercase">
              TESLİM ALAN
            </Text>
            <Box style={{ width: 200, borderBottom: '1px solid #000', marginTop: 40 }} />
            <Text size="xs" c="dimmed">
              Ad Soyad / İmza
            </Text>
          </Stack>
        </Group>
      </Box>

      {/* Print CSS (Global stiller — sadece yazdırma zamanında uygulanır) */}
      <style>
        {`
          @media print {
            /* Sayfa ayarları: A4 yatay */
            @page {
              size: A4 landscape;
              margin: 10mm;
            }

            /* Tüm sayfa elementlerini gizle */
            body > * {
              display: none !important;
            }

            /* Mantine overlay + modal wrapper */
            .mantine-Modal-root,
            .mantine-Modal-inner,
            .mantine-Modal-content {
              position: static !important;
              display: block !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              max-height: none !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              box-shadow: none !important;
              border: none !important;
              transform: none !important;
            }

            .mantine-Modal-overlay {
              display: none !important;
            }

            .mantine-Modal-header {
              display: none !important;
            }

            .mantine-Modal-body {
              padding: 0 !important;
            }

            /* Yazdırma butonlarını gizle */
            .no-print {
              display: none !important;
            }

            /* Senet alanını göster */
            .print-area {
              display: block !important;
              width: 100% !important;
              padding: 0 !important;
            }

            /* Tablo stili */
            table {
              width: 100% !important;
              font-size: 9pt !important;
            }

            th, td {
              border: 1px solid #333 !important;
              padding: 2px 4px !important;
            }
          }
        `}
      </style>
    </Modal>
  )
}
