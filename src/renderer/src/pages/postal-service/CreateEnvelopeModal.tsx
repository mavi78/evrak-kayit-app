// ============================================================
// CreateEnvelopeModal - Posta zarfı oluşturma / düzenleme modalı
//
// Sorumlulukları:
// 1. Alıcı adı girişi (boş başlar, zorunlu)
// 2. RR Kod girişi (opsiyonel, boşsa "-" gönderilir)
// 3. Pul seçimi ve adet girişi (dinamik satır)
// 4. Toplam maliyet dinamik hesaplama
// 5. Seçilen evrakları gösterme
// 6. Düzenleme modu: mevcut zarf verilerini yükleme
// ============================================================

import { useState, useMemo, useCallback } from 'react'
import {
  Modal,
  TextInput,
  Button,
  Group,
  Stack,
  Table,
  Text,
  Select,
  NumberInput,
  ActionIcon,
  Badge,
  Divider,
  Paper,
  Alert
} from '@mantine/core'
import { IconPlus, IconTrash, IconInfoCircle } from '@tabler/icons-react'
import type {
  PendingPostalDistribution,
  PostalStamp,
  PostalEnvelopeDetail,
  EnvelopeStampInput,
  CreatePostalEnvelopeRequest,
  UpdatePostalEnvelopeRequest
} from '@shared/types'
import { postalEnvelopeApi, postalStampApi } from '@renderer/lib/api'
import { handleApiResponse, showError } from '@renderer/lib/notifications'
import { useEffect } from 'react'

interface StampRow {
  id: string // Client-side unique key
  postal_stamp_id: number | null
  quantity: number
}

interface CreateEnvelopeModalProps {
  opened: boolean
  onClose: () => void
  onSuccess: () => void
  /** Yeni zarf oluşturma — seçili dağıtımlar */
  selectedDistributions?: PendingPostalDistribution[]
  /** Düzenleme modu — mevcut zarf bilgisi */
  editingEnvelope?: PostalEnvelopeDetail | null
}

export default function CreateEnvelopeModal({
  opened,
  onClose,
  onSuccess,
  selectedDistributions = [],
  editingEnvelope
}: CreateEnvelopeModalProps): React.JSX.Element {
  const isEditMode = !!editingEnvelope

  const [recipientName, setRecipientName] = useState('')
  const [rrCode, setRrCode] = useState('')
  const [stampRows, setStampRows] = useState<StampRow[]>([])
  const [stamps, setStamps] = useState<PostalStamp[]>([])
  const [loading, setLoading] = useState(false)

  // Pulları backend'den çek
  const fetchStamps = useCallback(async (): Promise<void> => {
    const response = await postalStampApi.getAll()
    if (response.success) {
      setStamps(response.data.filter((s) => s.is_active))
    }
  }, [])

  useEffect(() => {
    if (opened) {
      void (async () => {
        await fetchStamps()

        if (isEditMode && editingEnvelope) {
          // Düzenleme modu — mevcut verilerle doldur
          setRecipientName(editingEnvelope.recipient_name)
          setRrCode(editingEnvelope.rr_code === '-' ? '' : editingEnvelope.rr_code)
          setStampRows(
            editingEnvelope.stamps.map((s) => ({
              id: crypto.randomUUID(),
              postal_stamp_id: s.postal_stamp_id,
              quantity: s.quantity
            }))
          )
        } else {
          // Yeni zarf — boş başla
          setRecipientName('')
          setRrCode('')
          setStampRows([{ id: crypto.randomUUID(), postal_stamp_id: null, quantity: 1 }])
        }
      })()
    }
  }, [opened, editingEnvelope, isEditMode, fetchStamps])

  // Pul satırı ekle
  const addStampRow = (): void => {
    setStampRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), postal_stamp_id: null, quantity: 1 }
    ])
  }

  // Pul satırı kaldır
  const removeStampRow = (id: string): void => {
    setStampRows((prev) => prev.filter((r) => r.id !== id))
  }

  // Pul seçimi güncelle
  const updateStampRow = (
    id: string,
    field: 'postal_stamp_id' | 'quantity',
    value: number | null
  ): void => {
    setStampRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  // Select options — zaten seçilmiş pulları filtrele
  const stampOptions = useMemo(() => {
    const selectedIds = new Set(stampRows.map((r) => r.postal_stamp_id).filter(Boolean))
    return stamps.map((s) => ({
      value: String(s.id),
      label: `${s.amount.toFixed(2)} TL`,
      disabled: selectedIds.has(s.id)
    }))
  }, [stamps, stampRows])

  // Toplam maliyet hesapla
  const costBreakdown = useMemo(() => {
    const parts: { amount: number; quantity: number; subtotal: number }[] = []
    let total = 0
    for (const row of stampRows) {
      if (row.postal_stamp_id && row.quantity > 0) {
        const stamp = stamps.find((s) => s.id === row.postal_stamp_id)
        if (stamp) {
          const subtotal = stamp.amount * row.quantity
          parts.push({
            amount: stamp.amount,
            quantity: row.quantity,
            subtotal
          })
          total += subtotal
        }
      }
    }
    return { parts, total }
  }, [stampRows, stamps])

  // Maliyet özeti string
  const costSummaryText = useMemo(() => {
    if (costBreakdown.parts.length === 0) return ''
    const partTexts = costBreakdown.parts.map((p) => `${p.quantity} adet ${p.amount.toFixed(2)} TL`)
    return `${partTexts.join(' + ')} = ${costBreakdown.total.toFixed(2)} TL`
  }, [costBreakdown])

  // Kaydet
  const handleSubmit = async (): Promise<void> => {
    if (!recipientName.trim()) {
      showError('Alıcı adı zorunludur')
      return
    }

    const validStamps: EnvelopeStampInput[] = stampRows
      .filter((r) => r.postal_stamp_id && r.quantity > 0)
      .map((r) => ({
        postal_stamp_id: r.postal_stamp_id!,
        quantity: r.quantity
      }))

    if (validStamps.length === 0) {
      showError('En az bir pul eklemelisiniz')
      return
    }

    setLoading(true)

    if (isEditMode && editingEnvelope) {
      // Güncelleme
      const request: UpdatePostalEnvelopeRequest = {
        id: editingEnvelope.id,
        recipient_name: recipientName.trim(),
        rr_code: rrCode.trim() || undefined,
        stamps: validStamps
      }
      const response = await postalEnvelopeApi.updateEnvelope(request)
      handleApiResponse(response, {
        showSuccess: true,
        successMessage: 'Posta zarfı güncellendi'
      })
      if (response.success) {
        onSuccess()
        onClose()
      }
    } else {
      // Yeni oluşturma
      const request: CreatePostalEnvelopeRequest = {
        recipient_name: recipientName.trim(),
        rr_code: rrCode.trim() || undefined,
        distribution_ids: selectedDistributions.map((d) => d.distribution_id),
        stamps: validStamps
      }
      const response = await postalEnvelopeApi.createEnvelope(request)
      handleApiResponse(response, {
        showSuccess: true,
        successMessage: 'Posta zarfı oluşturuldu'
      })
      if (response.success) {
        onSuccess()
        onClose()
      }
    }

    setLoading(false)
  }

  // Evrak listesi — düzenleme modunda zarftan, yeni modunda seçimden
  const distributionList = isEditMode
    ? (editingEnvelope?.distributions ?? [])
    : selectedDistributions

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditMode ? 'Posta Zarfı Düzenle' : 'Posta Zarfı Oluştur'}
      size="lg"
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        {/* Alıcı adı */}
        <TextInput
          label="Alıcı Adı"
          placeholder="Alıcı birim/kurum adı"
          value={recipientName}
          onChange={(e) => setRecipientName(e.currentTarget.value)}
          required
        />

        {/* Seçilen evraklar */}
        <Paper withBorder p="xs" bg="gray.0">
          <Text size="xs" fw={600} mb={4}>
            {isEditMode ? 'Zarftaki Evraklar' : 'Seçilen Evraklar'} ({distributionList.length})
          </Text>
          <Table fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>K.No</Table.Th>
                <Table.Th>Konu</Table.Th>
                <Table.Th>Birim</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isEditMode
                ? editingEnvelope?.distributions.map((d) => (
                    <Table.Tr key={d.distribution_id}>
                      <Table.Td>{d.document_id}</Table.Td>
                      <Table.Td>{d.document_subject}</Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="light">
                          {d.unit_name}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))
                : selectedDistributions.map((d) => (
                    <Table.Tr key={d.distribution_id}>
                      <Table.Td>{d.document_id}</Table.Td>
                      <Table.Td>{d.document_subject}</Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="light">
                          {d.unit_name}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
            </Table.Tbody>
          </Table>
        </Paper>

        <Divider label="Pul Yönetimi" labelPosition="center" />

        {/* Pul satırları */}
        <Stack gap="xs">
          {stampRows.map((row) => (
            <Group key={row.id} gap="xs" align="flex-end">
              <Select
                label="Pul"
                placeholder="Pul seçin"
                data={stampOptions}
                value={row.postal_stamp_id ? String(row.postal_stamp_id) : null}
                onChange={(val) =>
                  updateStampRow(row.id, 'postal_stamp_id', val ? Number(val) : null)
                }
                style={{ flex: 1 }}
                searchable
                size="xs"
              />
              <NumberInput
                label="Adet"
                value={row.quantity}
                onChange={(val) =>
                  updateStampRow(row.id, 'quantity', typeof val === 'number' ? val : 1)
                }
                min={1}
                max={99}
                style={{ width: 80 }}
                size="xs"
              />
              <ActionIcon
                color="red"
                variant="subtle"
                onClick={() => removeStampRow(row.id)}
                disabled={stampRows.length <= 1}
                size="sm"
                mb={2}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          ))}

          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={addStampRow}
            w="fit-content"
          >
            Pul Ekle
          </Button>
        </Stack>

        {/* Toplam maliyet özeti */}
        {costBreakdown.total > 0 && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Toplam Maliyet"
            color="blue"
            variant="light"
          >
            <Text size="sm" fw={600}>
              {costSummaryText}
            </Text>
          </Alert>
        )}

        {/* RR Kod */}
        <TextInput
          label="RR Kod"
          placeholder="Opsiyonel RR kodu..."
          value={rrCode}
          onChange={(e) => setRrCode(e.currentTarget.value)}
        />

        {/* Kaydet */}
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose} disabled={loading}>
            İptal
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            {isEditMode ? 'Güncelle' : 'Zarfı Kaydet'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
