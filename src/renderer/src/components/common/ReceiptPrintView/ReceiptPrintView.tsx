// ============================================================
// ReceiptPrintView - Senet yazdırma bileşeni (Hidden Portal + Print)
//
// A4 yatay (landscape) formatta senet çıktısı:
// - Teslim edilen evrak listesi tablosu
// - Senet no, evrak bilgileri, birlik, imza alanları
// - Modal yerine gizli portal kullanır — printToPDF ile yakalama
//   için DOM'da render edilir ama kullanıcıya görünmez.
// - PDF oluşturma, önizleme ve yazdırma main process'te yönetilir.
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Box, Table, Text, Stack, Group } from '@mantine/core'
import { appSettingsApi, printApi, unitApi } from '@renderer/lib/api'
import type { DeliveredReceiptInfo, Classification } from '@shared/types'

interface ReceiptPrintViewProps {
  data: DeliveredReceiptInfo[]
  classifications: Classification[]
  targetUnitName: string
  onClose: () => void
}

/** Tarihi formatlama: YYYY-MM-DD → DD.MM.YYYY */
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split(/[- ]/)
  if (parts.length >= 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`
  }
  return dateStr
}

export function ReceiptPrintView({
  data,
  classifications,
  targetUnitName,
  onClose
}: ReceiptPrintViewProps): React.JSX.Element | null {
  const [organizationName, setOrganizationName] = useState<string>('BİRLİK BELİRTİLEMEDİ')

  // Birlik Ayarını Çek
  useEffect(() => {
    appSettingsApi.getOrganization().then((orgRes) => {
      if (orgRes.success && orgRes.data && orgRes.data.value) {
        const value = orgRes.data.value
        const unitId = Number(value)
        if (!isNaN(unitId)) {
          unitApi.getById(unitId).then((unitRes) => {
            if (unitRes.success && unitRes.data) {
              setOrganizationName(unitRes.data.short_name || unitRes.data.name)
            } else {
              setOrganizationName(value)
            }
          })
        } else {
          setOrganizationName(value)
        }
      }
    })
  }, [])

  const getClassificationName = useCallback(
    (classId: number): string => {
      const c = classifications.find((x) => x.id === classId)
      return c?.name ?? ''
    },
    [classifications]
  )

  // Bileşen mount olduğunda PDF oluştur ve yazdır
  // printReceiptPdf artık preview penceresi kapanana kadar resolve etmeyecek
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        await printApi.printReceiptPdf()
      } finally {
        onClose()
      }
    }, 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sabit formatlı veriler
  const selectedUnitName = data.length > 0 ? data[0].unit_name : ''
  const receiptNo = data.length > 0 ? data[0].receipt_no : ''
  const totalCount = data.length

  // İlk itemin delivery_date'i varsa formatlayıp ayıralım
  let deliveryDateStr = ''
  let deliveryTimeStr = ''
  if (data.length > 0 && data[0].delivery_date) {
    const parts = data[0].delivery_date.split(' ') // "YYYY-MM-DD HH:mm:ss"
    deliveryDateStr = formatDate(parts[0])
    deliveryTimeStr = parts[1] ? parts[1].substring(0, 5) : ''
  }

  // Gizli container — Portal ile document.body'ye render edilir
  // printToPDF CSS injection bu container'ı görünür yapacak
  return createPortal(
    <Box
      className="receipt-print-container"
      style={{
        position: 'fixed',
        left: '-9999px',
        top: 0,
        width: 0,
        height: 0,
        overflow: 'hidden',
        pointerEvents: 'none'
      }}
    >
      <Box className="print-area">
        {/* Çift Çizgi Başlık Alanı */}
        <Box
          style={{
            borderTop: '2px solid #000',
            borderBottom: '1px solid #000',
            padding: '4px 0',
            margin: '12px 0 8px 0',
            position: 'relative'
          }}
        >
          <Box
            style={{
              borderTop: '1px solid #000',
              borderBottom: '2px solid #000',
              padding: '6px 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Box style={{ width: 140 }}></Box>
            {/* Sol boşluk dengesi için */}
            <Text fw={800} size="md" tt="uppercase" style={{ flex: 1, textAlign: 'center' }}>
              EVRAK TESLİM İRSALİYESİ
            </Text>
            <Text fw={600} size="sm" style={{ width: 190, textAlign: 'right', paddingRight: 8 }}>
              PAKET NUMARASI: {receiptNo ? `#${receiptNo}#` : ''}
            </Text>
          </Box>
        </Box>

        <Group justify="space-between" align="center" mb="sm" px={4}>
          <Text fw={700} size="sm" tt="uppercase">
            NEREDEN : {organizationName}
          </Text>
          <Text fw={700} size="sm" ta="right" style={{ minWidth: 150 }}>
            {targetUnitName || selectedUnitName}
          </Text>
        </Group>

        {/* Evrak Tablosu */}
        <Table
          withTableBorder
          withColumnBorders
          fz="xs"
          styles={{
            table: {
              borderCollapse: 'collapse',
              border: '2px solid #000'
            },
            th: {
              padding: '6px',
              fontWeight: 700,
              fontSize: '0.65rem',
              color: '#000',
              borderColor: '#000',
              textAlign: 'center',
              verticalAlign: 'middle',
              background: '#f8f9fa'
            },
            td: {
              padding: '4px 6px',
              fontSize: '0.70rem',
              color: '#000',
              borderColor: '#000',
              verticalAlign: 'middle'
            }
          }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th colSpan={2} style={{ borderBottom: '1px solid #000' }}>
                Evrak Birimi
              </Table.Th>
              <Table.Th rowSpan={2} style={{ width: '20%' }}>
                Evrakı Çıkaran/Gönderen
                <br />
                Makam/Kişi
              </Table.Th>
              <Table.Th colSpan={3} style={{ borderBottom: '1px solid #000' }}>
                EVRAKIN
              </Table.Th>
              <Table.Th rowSpan={2} style={{ width: '10%' }}>
                Gizlilik Derecesi
              </Table.Th>
              <Table.Th rowSpan={2} style={{ width: '10%' }}>
                Güvenlik Nu./
                <br />
                Öncelik Derecesi
              </Table.Th>
              <Table.Th rowSpan={2} style={{ width: '15%' }}>
                Gönderildiği/Dağıtıldığı
                <br />
                Makam/Personel
              </Table.Th>
            </Table.Tr>
            <Table.Tr>
              <Table.Th style={{ width: '8%', borderTop: 'none' }}>
                Evrak Kayıt
                <br />
                Numarası
              </Table.Th>
              <Table.Th style={{ width: '8%', borderTop: 'none' }}>
                Kayıt Tarihi
                <br />
                TSG
              </Table.Th>
              <Table.Th style={{ width: '8%', borderTop: 'none' }}>Tarihi/TSG</Table.Th>
              <Table.Th style={{ width: '12%', borderTop: 'none' }}>Sayısı</Table.Th>
              <Table.Th style={{ width: '20%', borderTop: 'none' }}>Konusu</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((item) => (
              <Table.Tr key={item.distribution_id}>
                {/* Evrak Kayıt Numarası (İD) */}
                <Table.Td style={{ textAlign: 'center', fontWeight: 600 }}>
                  {item.document_id}
                </Table.Td>
                {/* Kayıt Tarihi TSG */}
                <Table.Td style={{ textAlign: 'center' }}>{formatDate(item.record_date)}</Table.Td>
                {/* Evrakı Çıkaran/Gönderen Makam */}
                <Table.Td>{item.source_office}</Table.Td>
                {/* Tarihi TSG */}
                <Table.Td style={{ textAlign: 'center' }}>
                  {formatDate(item.document_date)}
                </Table.Td>
                {/* Sayısı */}
                <Table.Td>{item.reference_number}</Table.Td>
                {/* Konusu */}
                <Table.Td>{item.subject}</Table.Td>
                {/* Gizlilik Derecesi */}
                <Table.Td style={{ textAlign: 'center' }}>
                  {getClassificationName(item.classification_id)}
                </Table.Td>
                {/* Güvenlik Nu */}
                <Table.Td style={{ textAlign: 'center' }}>
                  {item.security_control_no || ''}
                </Table.Td>
                {/* Gönderildiği Makam */}
                <Table.Td>{item.unit_name}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {/* Cümle (Özet satırı) */}
        <Box
          mt="md"
          mb="md"
          style={{ textAlign: 'center', pageBreakInside: 'avoid', breakInside: 'avoid' }}
        >
          <Text fw={700} size="sm">
            --------YALNIZ {totalCount} ADET EVRAK EKSİKSİZ OLARAK TESLİM EDİLMİŞ/ALINMIŞTIR--------
          </Text>
        </Box>

        {/* Alt Bilgiler: Teslim Tarihi / İmza Blokları */}
        <Group
          justify="center"
          gap={80}
          align="flex-start"
          mt="xl"
          px="xl"
          style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
        >
          <Stack gap={4} align="flex-start">
            <Group gap="xs">
              <Text fw={700} size="sm" style={{ width: 100 }}>
                TESLİM TARİHİ
              </Text>
              <Text fw={600} size="sm">
                : {deliveryDateStr}
              </Text>
            </Group>
            <Group gap="xs">
              <Text fw={700} size="sm" style={{ width: 100 }}>
                TESLİM SAATİ
              </Text>
              <Text fw={600} size="sm">
                : {deliveryTimeStr}
              </Text>
            </Group>
          </Stack>

          <Stack gap={4} align="flex-start" style={{ minWidth: 200 }}>
            <Text fw={700} size="sm" mb={4} style={{ textDecoration: 'underline' }}>
              TESLİM ALAN
            </Text>
            <Group gap="xs">
              <Text fw={600} size="sm" style={{ width: 50 }}>
                İmza
              </Text>
              <Text fw={600} size="sm">
                :
              </Text>
            </Group>
            <Group gap="xs">
              <Text fw={600} size="sm" style={{ width: 50 }}>
                Adı
              </Text>
              <Text fw={600} size="sm">
                :
              </Text>
            </Group>
            <Group gap="xs">
              <Text fw={600} size="sm" style={{ width: 50 }}>
                Soyadı
              </Text>
              <Text fw={600} size="sm">
                :
              </Text>
            </Group>
            <Group gap="xs">
              <Text fw={600} size="sm" style={{ width: 50 }}>
                Rütbesi
              </Text>
              <Text fw={600} size="sm">
                :
              </Text>
            </Group>
          </Stack>
        </Group>
      </Box>
    </Box>,
    document.body
  )
}
