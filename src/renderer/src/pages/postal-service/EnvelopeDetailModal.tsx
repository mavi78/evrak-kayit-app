// ============================================================
// EnvelopeDetailModal - Geçmiş zarf detay modalı
//
// Sorumlulukları:
// 1. Zarf bilgilerini gösterme (alıcı, tarih)
// 2. Pul dökümü tablosu
// 3. Toplam maliyet hesabı
// 4. İçerdiği evraklar listesi
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import {
  Modal,
  Stack,
  Text,
  Table,
  Group,
  Badge,
  Paper,
  Divider,
  Alert,
  Loader,
  Center
} from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import type { PostalEnvelopeDetail } from '@shared/types'
import { postalEnvelopeApi } from '@renderer/lib/api'
import { showError } from '@renderer/lib/notifications'

interface EnvelopeDetailModalProps {
  opened: boolean
  onClose: () => void
  envelopeId: number | null
}

export default function EnvelopeDetailModal({
  opened,
  onClose,
  envelopeId
}: EnvelopeDetailModalProps): React.JSX.Element {
  const [detail, setDetail] = useState<PostalEnvelopeDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchDetail = useCallback(async (): Promise<void> => {
    if (!envelopeId) return
    setLoading(true)
    const response = await postalEnvelopeApi.getEnvelopeDetail(envelopeId)
    if (response.success) {
      setDetail(response.data)
    } else {
      showError(response.message)
    }
    setLoading(false)
  }, [envelopeId])

  useEffect(() => {
    if (opened && envelopeId) {
      void (async () => {
        await fetchDetail()
      })()
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cleanup on close
    if (!opened) setDetail(null)
  }, [opened, envelopeId, fetchDetail])

  // Tarih formatlama
  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  // Maliyet özeti string
  const getCostSummary = (env: PostalEnvelopeDetail): string => {
    if (env.stamps.length === 0) return '0 TL'
    const parts = env.stamps.map((s) => `${s.quantity} adet ${s.stamp_amount.toFixed(2)} TL`)
    return `${parts.join(' + ')} = ${env.total_cost.toFixed(2)} TL`
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Zarf Detayı" size="lg">
      {loading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : detail ? (
        <Stack gap="md">
          {/* Zarf bilgileri */}
          <Group gap="xl">
            <div>
              <Text size="xs" c="dimmed">
                Alıcı
              </Text>
              <Text fw={600}>{detail.recipient_name}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Postalanma Tarihi
              </Text>
              <Text fw={600}>{formatDate(detail.created_at)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Zarf No
              </Text>
              <Badge variant="filled" size="lg">
                #{detail.id}
              </Badge>
            </div>
          </Group>

          {detail.rr_code && detail.rr_code !== '-' && (
            <Paper withBorder p="xs" bg="gray.0">
              <Text size="xs" c="dimmed">
                RR Kod
              </Text>
              <Text size="sm">{detail.rr_code}</Text>
            </Paper>
          )}

          <Divider label="Pul Dökümü" labelPosition="center" />

          {/* Pul tablosu */}
          <Table fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ textAlign: 'right' }}>Birim Fiyat</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Adet</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Ara Toplam</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {detail.stamps.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td style={{ textAlign: 'right' }}>{s.stamp_amount.toFixed(2)} TL</Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>{s.quantity}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {(s.stamp_amount * s.quantity).toFixed(2)} TL
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {/* Toplam maliyet */}
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Toplam Maliyet"
            color="blue"
            variant="light"
          >
            <Text size="sm" fw={600}>
              {getCostSummary(detail)}
            </Text>
          </Alert>

          <Divider label="Evraklar" labelPosition="center" />

          {/* Evrak tablosu */}
          <Table fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>K.No</Table.Th>
                <Table.Th>Konu</Table.Th>
                <Table.Th>Sayı</Table.Th>
                <Table.Th>Birim</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {detail.distributions.map((d) => (
                <Table.Tr key={d.distribution_id}>
                  <Table.Td>{d.document_id}</Table.Td>
                  <Table.Td>{d.document_subject}</Table.Td>
                  <Table.Td>{d.document_reference_number}</Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light">
                      {d.unit_name}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          Zarf bilgisi bulunamadı.
        </Text>
      )}
    </Modal>
  )
}
