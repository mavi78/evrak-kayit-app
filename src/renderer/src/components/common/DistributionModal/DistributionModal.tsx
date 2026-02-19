// ============================================================
// DistributionModal - Havale/Dağıtım form modal (sürüklenebilir)
//
// Referans tasarımdan esinlenilmiştir:
// - Birime Havale (autocomplete + arama, alt yazıda üst birlik)
// - Dağıtım Türü (GEREĞİ İÇİN GÖNDER, BİLGİ İÇİN GÖNDER)
// - Kişiye Havale (kullanıcı seçimi)
// - Onaylayacak Kişi
// - Açıklama (textarea, max 1000 karakter)
// - İşlem Süresi (görüntüleme alanı)
// - Mevcut dağıtımlar listesi + silme
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Modal,
  Stack,
  Group,
  Select,
  Button,
  Text,
  Table,
  ActionIcon,
  ScrollArea,
  Badge,
  Divider,
  Box,
  useMantineTheme
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconPlus,
  IconTrash,
  IconGripVertical,
  IconArrowsLeftRight,
  IconCheck
} from '@tabler/icons-react'
import { incomingDocumentApi } from '@renderer/lib/api'
import { useConfirmModal } from '@renderer/hooks/useConfirmModal'
import type { DocumentDistribution, DocumentScope, Unit, Channel } from '@shared/types'
import { UnitTreePicker } from '@renderer/components/common'

export interface DistributionModalProps {
  opened: boolean
  onClose: () => void
  documentId: number | null
  documentScope: DocumentScope
  units: Unit[]
  channels: Channel[]
  onDistributionsChange?: () => void
}

function useDraggable(): {
  position: { x: number; y: number }
  onMouseDown: (e: React.MouseEvent) => void
  isDragging: boolean
  reset: () => void
} {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const posStartRef = useRef({ x: 0, y: 0 })

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Sadece sol tıkla sürükle
      if (e.button !== 0) return
      // Input/select/button üzerinde sürüklemeyi engelle
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (['input', 'select', 'button', 'textarea', 'svg', 'path'].includes(tag)) return

      setIsDragging(true)
      dragStartRef.current = { x: e.clientX, y: e.clientY }
      posStartRef.current = { ...position }
      e.preventDefault()
    },
    [position]
  )

  useEffect(() => {
    if (!isDragging) return

    const onMouseMove = (e: MouseEvent): void => {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      setPosition({
        x: posStartRef.current.x + dx,
        y: posStartRef.current.y + dy
      })
    }

    const onMouseUp = (): void => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging])

  const reset = useCallback(() => setPosition({ x: 0, y: 0 }), [])

  return { position, onMouseDown, isDragging, reset }
}

/** Sol etiket — sağ input layout satırı */
function FormRow({
  label,
  children,
  labelWidth = 140
}: {
  label: string
  children: React.ReactNode
  labelWidth?: number
}): React.JSX.Element {
  return (
    <Group gap="sm" align="flex-start" wrap="nowrap">
      <Text
        size="sm"
        fw={600}
        c="dimmed"
        style={{
          width: labelWidth,
          minWidth: labelWidth,
          textAlign: 'right',
          paddingTop: 7,
          flexShrink: 0
        }}
      >
        {label}
      </Text>
      <Box style={{ flex: 1 }}>{children}</Box>
    </Group>
  )
}

export function DistributionModal({
  opened,
  onClose,
  documentId,
  documentScope,
  units,
  channels,
  onDistributionsChange
}: DistributionModalProps): React.JSX.Element {
  const theme = useMantineTheme()
  const { position, onMouseDown, isDragging, reset } = useDraggable()
  const { confirm, ConfirmModal } = useConfirmModal()

  // Mevcut dağıtımlar
  const [distributions, setDistributions] = useState<DocumentDistribution[]>([])
  const [loading, setLoading] = useState(false)

  // Form state
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  // Dağıtımları yükle
  const loadDistributions = useCallback(async () => {
    if (!documentId) return
    setLoading(true)
    try {
      const res = await incomingDocumentApi.getDistributions(documentId, documentScope)
      if (res.success) setDistributions(res.data)
      else setDistributions([])
    } finally {
      setLoading(false)
    }
  }, [documentId, documentScope])

  useEffect(() => {
    if (opened && documentId) {
      void loadDistributions()
      reset()
    }
    if (!opened) {
      setSelectedUnitIds([])
      setSelectedChannelId(null)
      setDistributions([])
    }
  }, [opened, documentId, loadDistributions, reset])

  // Dağıtım ekle (Toplu)
  const handleAdd = useCallback(async () => {
    if (!documentId || selectedUnitIds.length === 0 || !selectedChannelId) {
      notifications.show({
        title: 'Uyarı',
        message: 'Lütfen en az bir birlik ve kanal seçin',
        color: 'yellow'
      })
      return
    }

    setAdding(true)
    let addedCount = 0
    let skippedCount = 0

    try {
      for (const unitId of selectedUnitIds) {
        // Mükerrer kontrolü
        const alreadyExists = distributions.some((d) => d.unit_id === unitId)
        if (alreadyExists) {
          skippedCount++
          continue
        }

        const res = await incomingDocumentApi.addDistribution({
          document_id: documentId,
          document_scope: documentScope,
          unit_id: unitId,
          channel_id: Number(selectedChannelId)
        })

        if (res.success) {
          addedCount++
        } else {
          // Bir hata olursa şimdilik sadece saymayalım veya loglayalım
          console.error(`Unit ${unitId} eklenirken hata:`, res.message)
        }
      }

      // Sonuç bildirimi
      if (addedCount > 0) {
        notifications.show({
          title: 'İşlem Başarılı',
          message: `${addedCount} birim dağıtıma eklendi.${
            skippedCount > 0 ? ` (${skippedCount} birim zaten listedeydi)` : ''
          }`,
          color: 'green',
          icon: <IconCheck size={16} />
        })
        setSelectedUnitIds([]) // Seçimi temizle
        // Kanalı temizlemeyelim, seri ekleme yapılabilir
        // setSelectedChannelId(null)
        void loadDistributions()
        onDistributionsChange?.()
      } else if (skippedCount > 0) {
        notifications.show({
          title: 'Uyarı',
          message: `Seçilen ${skippedCount} birim zaten listede ekli.`,
          color: 'yellow'
        })
      } else {
        notifications.show({
          title: 'Hata',
          message: 'Dağıtım eklenemedi.',
          color: 'red'
        })
      }
    } finally {
      setAdding(false)
    }
  }, [
    documentId,
    documentScope,
    selectedUnitIds,
    selectedChannelId,
    distributions,
    loadDistributions,
    onDistributionsChange
  ])

  // Dağıtım sil — posta zarfı uyarısı ile
  const handleDelete = useCallback(
    async (dist: DocumentDistribution) => {
      // Posta kanalıyla teslim edilmişse kullanıcıdan onay al
      const isPostal =
        dist.is_delivered &&
        channels.find((c) => c.id === dist.channel_id)?.name?.toLowerCase() === 'posta'

      if (isPostal) {
        const ok = await confirm({
          title: 'Posta Zarfı Uyarısı',
          message:
            'Bu dağıtım bir posta zarfına bağlıdır.\n\n' +
            'Silinirse posta zarfından çıkarılacak ve zarf boş kalırsa zarf tamamen silinecektir.\n\n' +
            'Devam etmek istiyor musunuz?',
          confirmLabel: 'Evet, Sil',
          color: 'orange'
        })
        if (!ok) return
      }

      const res = await incomingDocumentApi.deleteDistribution(dist.id, isPostal || undefined)

      // Backend posta uyarısı döndüyse
      if (!res.success && res.message === 'POSTAL_ENVELOPE_WARNING') {
        const ok = await confirm({
          title: 'Posta Zarfı Uyarısı',
          message:
            'Bu dağıtım bir posta zarfına bağlıdır.\n\n' +
            'Silinirse posta zarfından çıkarılacak ve zarf boş kalırsa zarf tamamen silinecektir.\n\n' +
            'Devam etmek istiyor musunuz?',
          confirmLabel: 'Evet, Sil',
          color: 'orange'
        })
        if (!ok) return
        const retryRes = await incomingDocumentApi.deleteDistribution(dist.id, true)
        if (retryRes.success) {
          notifications.show({ title: 'Başarılı', message: 'Dağıtım kaldırıldı', color: 'teal' })
          void loadDistributions()
          onDistributionsChange?.()
        } else {
          notifications.show({
            title: 'Hata',
            message: retryRes.message || 'Dağıtım silinemedi',
            color: 'red'
          })
        }
        return
      }

      if (res.success) {
        notifications.show({ title: 'Başarılı', message: 'Dağıtım kaldırıldı', color: 'teal' })
        void loadDistributions()
        onDistributionsChange?.()
      } else {
        notifications.show({
          title: 'Hata',
          message: res.message || 'Dağıtım silinemedi',
          color: 'red'
        })
      }
    },
    [loadDistributions, onDistributionsChange, channels, confirm]
  )

  // Select verileri
  // unitSelectData kaldırıldı - UnitTreePicker kullanılıyor

  const channelSelectData = channels
    .filter((c) => c.is_active)
    .map((c) => ({
      value: String(c.id),
      label: c.name
    }))

  // Yardımcılar
  const getUnitName = (unitId: number): string => {
    const u = units.find((x) => x.id === unitId)
    return u?.short_name ?? u?.name ?? String(unitId)
  }

  const getChannelName = (channelId: number): string => {
    const c = channels.find((x) => x.id === channelId)
    return c?.name ?? String(channelId)
  }

  // Seçilen birlikleri listeden çıkarma
  const handleRemoveSelected = (id: number): void => {
    setSelectedUnitIds((prev) => prev.filter((uid) => uid !== id))
  }

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        withCloseButton={false}
        size={660}
        centered
        radius="md"
        padding={0}
        overlayProps={{ backgroundOpacity: 0.35, blur: 2 }}
        styles={{
          content: {
            transform: `translate(${position.x}px, ${position.y}px)`,
            transition: isDragging ? 'none' : 'transform 0.15s ease',
            overflow: 'visible',
            boxShadow: isDragging ? '0 12px 40px rgba(0,0,0,0.25)' : '0 8px 24px rgba(0,0,0,0.15)'
          },
          inner: {
            padding: 0
          }
        }}
      >
        {/* Sürüklenebilir başlık çubuğu */}
        <Box
          onMouseDown={onMouseDown}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            background: `linear-gradient(135deg, ${theme.colors.deniz[5]} 0%, ${theme.colors.deniz[7]} 100%)`,
            borderTopLeftRadius: theme.radius.md,
            borderTopRightRadius: theme.radius.md,
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
        >
          <Group gap="xs">
            <IconGripVertical size={16} color="rgba(255,255,255,0.5)" />
            <IconArrowsLeftRight size={18} color="white" />
            <Text fw={700} size="sm" c="white">
              HAVALE / DAĞITIM
            </Text>
            {documentId && (
              <Badge variant="filled" color="rgba(255,255,255,0.2)" size="sm" c="white">
                K.No: {documentId}
              </Badge>
            )}
          </Group>
          <ActionIcon
            variant="subtle"
            color="white"
            size="sm"
            onClick={onClose}
            style={{ opacity: 0.8 }}
          >
            ✕
          </ActionIcon>
        </Box>

        {/* Form alanı */}
        <Box p="md">
          <Stack gap="sm">
            {/* Birime Havale */}
            <FormRow label="Birime Havale">
              <UnitTreePicker
                units={units}
                values={selectedUnitIds}
                onChange={setSelectedUnitIds}
              />
              {/* Seçili Birlikler Listesi */}
              {selectedUnitIds.length > 0 && (
                <Group gap={6} mt={8} style={{ flexWrap: 'wrap' }}>
                  {selectedUnitIds.map((uid) => (
                    <Badge
                      key={uid}
                      size="lg"
                      variant="light"
                      color="deniz"
                      styles={{ label: { fontSize: '0.78rem' } }}
                      rightSection={
                        <ActionIcon
                          size="xs"
                          color="red"
                          radius="xl"
                          variant="transparent"
                          onClick={() => handleRemoveSelected(uid)}
                        >
                          <IconTrash size={12} />
                        </ActionIcon>
                      }
                    >
                      {getUnitName(uid)}
                    </Badge>
                  ))}
                </Group>
              )}
            </FormRow>

            {/* Kanal */}
            <FormRow label="Kanal">
              <Select
                placeholder="Kanal seçin..."
                data={channelSelectData}
                value={selectedChannelId}
                onChange={setSelectedChannelId}
                searchable
                nothingFoundMessage="Kanal bulunamadı"
                clearable
                size="sm"
              />
            </FormRow>

            {/* Ekle butonu */}
            <Group justify="flex-end" mt={4}>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleAdd}
                loading={adding}
                color="deniz"
                size="sm"
              >
                Dağıtım Ekle
              </Button>
            </Group>
          </Stack>

          <Divider my="md" />

          {/* Mevcut dağıtımlar listesi */}
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={700} tt="uppercase" c="deniz.7">
                Dağıtım Listesi
              </Text>
              <Badge variant="light" color="deniz" size="sm">
                {distributions.length} kayıt
              </Badge>
            </Group>

            {loading ? (
              <Text size="sm" c="dimmed" ta="center" py="md">
                Yükleniyor...
              </Text>
            ) : distributions.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="md">
                Henüz dağıtım kaydı yok.
              </Text>
            ) : (
              <ScrollArea h={180} scrollbarSize={4} type="hover">
                <Table
                  striped
                  highlightOnHover
                  fz="xs"
                  styles={{
                    table: { borderCollapse: 'separate', borderSpacing: 0 },
                    thead: {
                      background: `linear-gradient(180deg, ${theme.colors.deniz[4]} 0%, ${theme.colors.deniz[6]} 50%, ${theme.colors.deniz[8]} 100%)`
                    },
                    th: {
                      padding: '5px 8px',
                      fontWeight: 800,
                      fontSize: '0.68rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: theme.colors.deniz[0],
                      background: 'transparent',
                      borderBottom: 'none'
                    },
                    td: {
                      padding: '5px 8px',
                      fontSize: '0.72rem'
                    }
                  }}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ borderTopLeftRadius: theme.radius.sm }}>
                        BİRLİK ADI
                      </Table.Th>
                      <Table.Th style={{ textAlign: 'center' }}>DAĞITIM ŞEKLİ</Table.Th>
                      <Table.Th style={{ textAlign: 'center' }}>TESLİM DURUMU</Table.Th>
                      <Table.Th style={{ textAlign: 'center' }}>TESLİM TARİHİ</Table.Th>
                      <Table.Th style={{ textAlign: 'center' }}>SENT NO</Table.Th>
                      <Table.Th
                        style={{
                          textAlign: 'center',
                          borderTopRightRadius: theme.radius.sm
                        }}
                      >
                        SİL
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {distributions.map((d) => (
                      <Table.Tr key={d.id}>
                        <Table.Td>{getUnitName(d.unit_id)}</Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          {getChannelName(d.channel_id)}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Badge
                            size="xs"
                            color={d.is_delivered ? 'green' : 'red'}
                            variant="filled"
                          >
                            {d.is_delivered ? 'Evet' : 'Hayır'}
                          </Badge>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          {d.delivery_date ?? '—'}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>{d.receipt_no ?? '—'}</Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => void handleDelete(d)}
                            title="Dağıtımı kaldır"
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Stack>
        </Box>
      </Modal>
      {ConfirmModal}
    </>
  )
}
