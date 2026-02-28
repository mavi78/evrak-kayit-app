// ============================================================
// CourierNotDeliveredPage - Kurye ile teslim edilmeyen evraklar
//
// Akış:
// 1. UnitTreePicker ile birlik seç (tekli) → otomatik listele
// 2. Tablo: teslim edilmemiş kurye dağıtımları (checkbox)
//    - Alt birlikleri (rekürsif) varsa birlik adıyla gruplandırılır
// 3. Toplu / tekli seçim → "Teslim Et ve Yazdır"
// 4. Başarılı teslim → ReceiptPrintView modal açılır
// 5. Çakışma kontrolü — başka kullanıcı teslim ettiyse uyarı
// ============================================================

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Box,
  Card,
  Stack,
  Title,
  Text,
  Group,
  Button,
  Table,
  Checkbox,
  Badge,
  ScrollArea,
  Modal,
  LoadingOverlay,
  useMantineTheme
} from '@mantine/core'
import { IconPrinter, IconCheck, IconAlertTriangle } from '@tabler/icons-react'
import { useAuth } from '@renderer/hooks/useAuth'
import { UnitTreePicker } from '@renderer/components/common'
import {
  incomingDocumentApi,
  outgoingDocumentApi,
  transitDocumentApi,
  unitApi,
  classificationApi
} from '@renderer/lib/api'
import { showError, showSuccess } from '@renderer/lib/notifications'
import { ReceiptPrintView } from '@renderer/components/common/ReceiptPrintView/ReceiptPrintView'
import type {
  Unit,
  Classification,
  CourierPendingDistribution,
  DeliveredReceiptInfo,
  BulkDeliverResponse,
  DocumentScope,
  ServiceResponse
} from '@shared/types'

const PAGE_DESCRIPTION =
  'Gelen, Giden ve Transit evraklara ait olup henüz teslim edilmemiş kurye belgelerini birlik bazlı listeleyebilir, ' +
  'toplu veya tekli seçimle teslim edebilir ve senet yazdırabilirsiniz.'

/** Tarih formatlama: YYYY-MM-DD → DD.MM.YYYY */
function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const parts = dateStr.split(/[- ]/)
  if (parts.length >= 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`
  }
  return dateStr
}

export default function CourierNotDeliveredPage(): React.JSX.Element {
  const theme = useMantineTheme()
  const { state: authState } = useAuth()

  // Birim ve sınıflandırma verileri
  const [units, setUnits] = useState<Unit[]>([])
  const [classifications, setClassifications] = useState<Classification[]>([])

  // Seçilen birlik ID (UnitTreePicker — tekli seçim)
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([])

  // Teslim edilmemiş dağıtımlar
  const [pendingList, setPendingList] = useState<CourierPendingDistribution[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Seçili dağıtımlar (checkbox)
  const [selectedDistIds, setSelectedDistIds] = useState<Set<number>>(new Set())

  // Teslim işlemi
  const [delivering, setDelivering] = useState(false)

  // Senet yazdırma
  const [printData, setPrintData] = useState<DeliveredReceiptInfo[] | null>(null)
  const [printing, setPrinting] = useState(false)

  // Çakışma modalı state'leri
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [conflictData, setConflictData] = useState<{
    delivered: DeliveredReceiptInfo[]
    failed: BulkDeliverResponse['failed']
  } | null>(null)

  // Referans verileri yükle
  useEffect(() => {
    unitApi.getAll().then((res) => {
      if (res.success) setUnits(res.data)
    })
    classificationApi.getAll().then((res) => {
      if (res.success) setClassifications(res.data)
    })
  }, [])

  // Birlik seçimine göre alt birlikleri belirleme mantığı (rekürsif — ucuna kadar)
  const resolvedUnitIds = useMemo(() => {
    if (selectedUnitIds.length === 0) return []

    const result: number[] = []

    /** Rekürsif olarak seçilen birlik + tüm alt birlikleri toplar (ara dahil) */
    function collectDescendants(parentId: number): void {
      result.push(parentId)
      const children = units.filter((u) => u.parent_id === parentId && u.is_active)
      for (const c of children) {
        collectDescendants(c.id)
      }
    }

    for (const uid of selectedUnitIds) {
      collectDescendants(uid)
    }
    return [...new Set(result)] // Duplike önle
  }, [selectedUnitIds, units])

  // Birlik seçimi değiştiğinde otomatik listele
  useEffect(() => {
    if (resolvedUnitIds.length === 0) {
      // Seçim temizlendi — listeyi sıfırla
      setPendingList([])
      setSelectedDistIds(new Set())
      setHasSearched(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setHasSearched(true)
    setSelectedDistIds(new Set())

    Promise.allSettled([
      incomingDocumentApi.courierPending(resolvedUnitIds),
      outgoingDocumentApi.courierPending(resolvedUnitIds),
      transitDocumentApi.courierPending(resolvedUnitIds)
    ])
      .then((results) => {
        if (cancelled) return

        let allPending: CourierPendingDistribution[] = []
        let hasError = false

        results.forEach((res) => {
          if (res.status === 'fulfilled' && res.value.success) {
            allPending = [...allPending, ...res.value.data]
          } else {
            hasError = true
          }
        })

        if (hasError) {
          showError('Bazı veriler yüklenirken hata oluştu')
        }

        // Sıralama (tarih/id vb. eklenebilir, şimdilik olduğu gibi bırakıyoruz)
        setPendingList(allPending)
      })
      .catch(() => {
        if (cancelled) return
        showError('Veri yüklenirken bir genel hata oluştu')
        setPendingList([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [resolvedUnitIds])

  // Tümünü seç/bırak
  const allSelected = pendingList.length > 0 && selectedDistIds.size === pendingList.length
  const someSelected = selectedDistIds.size > 0 && selectedDistIds.size < pendingList.length

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedDistIds(new Set())
    } else {
      setSelectedDistIds(new Set(pendingList.map((d) => d.distribution_id)))
    }
  }, [allSelected, pendingList])

  const handleToggleRow = useCallback((distId: number) => {
    setSelectedDistIds((prev) => {
      const next = new Set(prev)
      if (next.has(distId)) next.delete(distId)
      else next.add(distId)
      return next
    })
  }, [])

  // Listeyi yenile (birlik seçimine göre tekrar çek)
  const refreshList = useCallback(() => {
    if (resolvedUnitIds.length === 0) return
    setLoading(true)
    setSelectedDistIds(new Set())
    Promise.allSettled([
      incomingDocumentApi.courierPending(resolvedUnitIds),
      outgoingDocumentApi.courierPending(resolvedUnitIds),
      transitDocumentApi.courierPending(resolvedUnitIds)
    ])
      .then((results) => {
        let allPending: CourierPendingDistribution[] = []
        let hasError = false

        results.forEach((res) => {
          if (res.status === 'fulfilled' && res.value.success) {
            allPending = [...allPending, ...res.value.data]
          } else {
            hasError = true
          }
        })

        if (hasError) {
          showError('Bazı veriler yüklenirken hata oluştu')
        }
        setPendingList(allPending)
      })
      .catch(() => {
        showError('Veri yüklenirken bir genel hata oluştu')
        setPendingList([])
      })
      .finally(() => setLoading(false))
  }, [resolvedUnitIds])

  // Teslim et
  const handleDeliver = useCallback(async () => {
    if (selectedDistIds.size === 0) {
      showError('Teslim edilecek en az bir evrak seçin')
      return
    }
    if (!authState.user) {
      showError('Oturum bilgisi bulunamadı')
      return
    }
    setDelivering(true)
    try {
      // Seçili dağıtımları scope'lara göre grupla
      const selectedDistributions = pendingList.filter((d) =>
        selectedDistIds.has(d.distribution_id)
      )
      const groupedByScope = selectedDistributions.reduce(
        (acc, curr) => {
          if (!acc[curr.document_scope]) acc[curr.document_scope] = []
          acc[curr.document_scope].push(curr.distribution_id)
          return acc
        },
        {} as Record<DocumentScope, number[]>
      )

      const promises: Promise<ServiceResponse<BulkDeliverResponse>>[] = []

      if (groupedByScope['INCOMING']?.length) {
        promises.push(
          incomingDocumentApi.courierBulkDeliver({
            distribution_ids: groupedByScope['INCOMING'],
            delivered_by_user_id: authState.user.id,
            delivered_by_name: authState.user.full_name
          })
        )
      }
      if (groupedByScope['OUTGOING']?.length) {
        promises.push(
          outgoingDocumentApi.courierBulkDeliver({
            distribution_ids: groupedByScope['OUTGOING'],
            delivered_by_user_id: authState.user.id,
            delivered_by_name: authState.user.full_name
          })
        )
      }
      if (groupedByScope['TRANSIT']?.length) {
        promises.push(
          transitDocumentApi.courierBulkDeliver({
            distribution_ids: groupedByScope['TRANSIT'],
            delivered_by_user_id: authState.user.id,
            delivered_by_name: authState.user.full_name
          })
        )
      }

      const results = await Promise.allSettled(promises)

      let allDelivered: DeliveredReceiptInfo[] = []
      let allFailed: BulkDeliverResponse['failed'] = []
      let errorOccurred = false

      for (const res of results) {
        if (res.status === 'fulfilled' && res.value.success && res.value.data) {
          allDelivered = [...allDelivered, ...res.value.data.delivered]
          allFailed = [...allFailed, ...res.value.data.failed]
        } else {
          errorOccurred = true
        }
      }

      const conflicts = allFailed.filter((f) => f.already_delivered_by)

      if (allDelivered.length === 0 && conflicts.length > 0) {
        showError(
          'Seçtiğiniz tüm evraklar başka bir kullanıcı tarafından zaten teslim edilmiş. Sayfa yenileniyor...'
        )
        refreshList()
      } else if (allDelivered.length > 0 && conflicts.length > 0) {
        setConflictData({ delivered: allDelivered, failed: conflicts })
        setConflictModalOpen(true)
        setPendingList((prev) =>
          prev.filter((d) => !allDelivered.some((del) => del.distribution_id === d.distribution_id))
        )
        setSelectedDistIds(new Set())
      } else {
        if (allDelivered.length > 0) {
          showSuccess(`${allDelivered.length} evrak teslim edildi`)
          setPrintData(allDelivered)
          setPrinting(true)
          setPendingList((prev) =>
            prev.filter(
              (d) => !allDelivered.some((del) => del.distribution_id === d.distribution_id)
            )
          )
          setSelectedDistIds(new Set())
        }
        if (allFailed.length > 0 || errorOccurred) {
          showError(`${allFailed.length} evrak teslim edilemedi veya işlem sırasında hata oluştu`)
        }
      }
    } catch {
      showError('Teslim işlemi sırasında bir hata oluştu')
    } finally {
      setDelivering(false)
    }
  }, [selectedDistIds, authState.user, refreshList, pendingList])

  // Çakışma modalı: Kabul Et
  const handleConflictAccept = useCallback(() => {
    if (conflictData) {
      showSuccess(`${conflictData.delivered.length} evrak teslim edildi`)
      setPrintData(conflictData.delivered)
      setPrinting(true)
      // Çakışan dağıtımları da listeden çıkar
      const conflictDistIds = new Set(conflictData.failed.map((f) => f.distribution_id))
      setPendingList((prev) => prev.filter((d) => !conflictDistIds.has(d.distribution_id)))
    }
    setConflictModalOpen(false)
    setConflictData(null)
  }, [conflictData])

  // Çakışma modalı: Reddet
  const handleConflictReject = useCallback(() => {
    setConflictModalOpen(false)
    setConflictData(null)
    refreshList()
  }, [refreshList])

  // Yardımcılar

  const getClassificationName = useCallback(
    (classId: number): string => {
      const c = classifications.find((x) => x.id === classId)
      return c?.name ?? ''
    },
    [classifications]
  )

  const getScopeBadge = (scope: DocumentScope): React.JSX.Element => {
    switch (scope) {
      case 'INCOMING':
        return (
          <Badge color="blue" variant="light" size="xs">
            GELEN
          </Badge>
        )
      case 'OUTGOING':
        return (
          <Badge color="orange" variant="light" size="xs">
            GİDEN
          </Badge>
        )
      case 'TRANSIT':
        return (
          <Badge color="grape" variant="light" size="xs">
            TRANSİT
          </Badge>
        )
      default:
        return (
          <Badge color="gray" variant="light" size="xs">
            {scope}
          </Badge>
        )
    }
  }

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        gap: 'var(--mantine-spacing-sm)',
        position: 'relative'
      }}
    >
      {/* PDF oluşturulurken sayfa seviyesinde loading */}
      <LoadingOverlay
        visible={printing}
        zIndex={1000}
        overlayProps={{ blur: 2 }}
        loaderProps={{ type: 'bars', color: 'teal' }}
      />
      {/* Başlık */}
      <Stack gap={4}>
        <Title order={3} style={{ margin: 0 }}>
          Teslim Edilmeyen
        </Title>
        <Text size="sm" c="dimmed">
          {PAGE_DESCRIPTION}
        </Text>
      </Stack>

      {/* Birlik seçim kartı */}
      <Card
        withBorder
        shadow="sm"
        radius="md"
        padding="sm"
        style={{ flexShrink: 0, position: 'relative', zIndex: 20, overflow: 'visible' }}
      >
        <Box>
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            Birlik Seçimi
          </Text>
          <UnitTreePicker
            units={units}
            values={selectedUnitIds}
            onChange={setSelectedUnitIds}
            singleSelect
          />
        </Box>
      </Card>

      {/* Evrak listesi */}
      <Card
        withBorder
        shadow="sm"
        radius="md"
        padding="sm"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
            <Text fw={700} size="sm" tt="uppercase">
              TESLİM EDİLMEYEN EVRAKLAR
            </Text>
            {pendingList.length > 0 && (
              <Badge variant="light" color="deniz" size="sm">
                {pendingList.length} kayıt
              </Badge>
            )}
          </Group>
          {selectedDistIds.size > 0 && (
            <Badge variant="filled" color="teal" size="sm">
              {selectedDistIds.size} seçili
            </Badge>
          )}
        </Group>

        <Box style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {!hasSearched ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              Birlik ağacından seçim yaparak evrakları görüntüleyin.
            </Text>
          ) : loading ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              Yükleniyor...
            </Text>
          ) : pendingList.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              Seçilen birliğe ait teslim edilmemiş kurye evrakı bulunamadı.
            </Text>
          ) : (
            <ScrollArea h="100%" scrollbarSize={6} type="hover">
              <Table
                striped
                highlightOnHover
                fz="xs"
                styles={{
                  table: { borderCollapse: 'separate', borderSpacing: 0 },
                  thead: {
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    background: `linear-gradient(180deg, ${theme.colors.deniz[4]} 0%, ${theme.colors.deniz[6]} 50%, ${theme.colors.deniz[8]} 100%)`
                  },
                  th: {
                    padding: '6px 8px',
                    fontWeight: 800,
                    fontSize: '0.68rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: theme.colors.deniz[0],
                    background: 'transparent',
                    borderBottom: 'none',
                    whiteSpace: 'nowrap'
                  },
                  td: {
                    padding: '5px 8px',
                    fontSize: '0.72rem'
                  }
                }}
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th
                      style={{
                        width: 40,
                        textAlign: 'center',
                        borderTopLeftRadius: theme.radius.sm
                      }}
                    >
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={handleSelectAll}
                        size="xs"
                        color="white"
                        styles={{
                          input: {
                            borderColor: 'rgba(255,255,255,0.6)',
                            backgroundColor:
                              allSelected || someSelected ? theme.colors.deniz[9] : 'transparent'
                          }
                        }}
                      />
                    </Table.Th>
                    <Table.Th style={{ width: 60 }}>K.NO</Table.Th>
                    <Table.Th style={{ width: 80 }}>KAPSAM</Table.Th>
                    <Table.Th>GÖNDEREN MAKAM</Table.Th>
                    <Table.Th>SAYISI</Table.Th>
                    <Table.Th style={{ minWidth: 180 }}>KONUSU</Table.Th>
                    <Table.Th style={{ width: 100 }}>TARİHİ</Table.Th>
                    <Table.Th style={{ width: 80 }}>GİZLİLİK</Table.Th>
                    <Table.Th style={{ width: 80 }}>GÜV.K.NO</Table.Th>
                    <Table.Th
                      style={{
                        width: 100,
                        borderTopRightRadius: theme.radius.sm
                      }}
                    >
                      KAYIT TARİHİ
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(() => {
                    // Alt birlik bazlı gruplandırma (rekürsif)
                    const selectedId = selectedUnitIds[0] ?? null
                    const selectedUnit = selectedId ? units.find((u) => u.id === selectedId) : null

                    // unit_id'ye göre birlik adını bul
                    const getUnitLabel = (unitId: number): string => {
                      const u = units.find((x) => x.id === unitId)
                      return u?.short_name || u?.name || String(unitId)
                    }

                    // Evrakları unit_id bazlı grupla
                    const groupMap = new Map<string, CourierPendingDistribution[]>()
                    for (const d of pendingList) {
                      const label = getUnitLabel(d.unit_id)
                      const arr = groupMap.get(label) ?? []
                      arr.push(d)
                      groupMap.set(label, arr)
                    }

                    // Tek birlik mi, çoklu mu?
                    const groups = Array.from(groupMap.entries()).map(([unitName, items]) => ({
                      unitName,
                      items
                    }))

                    // Tek grup ve seçilen birliğin kendisi ise başlık göstermeye gerek yok
                    const showGroupHeaders =
                      groups.length > 1 ||
                      (groups.length === 1 &&
                        selectedUnit &&
                        groups[0].unitName !== (selectedUnit.short_name || selectedUnit.name))

                    return groups.map((group) => (
                      <React.Fragment key={group.unitName}>
                        {/* Birlik başlık satırı — Badge ile belirgin */}
                        {showGroupHeaders && (
                          <Table.Tr>
                            <Table.Td
                              colSpan={10}
                              style={{
                                background: theme.colors.deniz[0],
                                padding: '6px 8px',
                                borderBottom: `2px solid ${theme.colors.deniz[3]}`
                              }}
                            >
                              <Group gap="xs">
                                <Badge
                                  variant="filled"
                                  color="deniz"
                                  size="sm"
                                  radius="sm"
                                  styles={{
                                    root: {
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.05em',
                                      fontWeight: 800,
                                      fontSize: '0.7rem'
                                    }
                                  }}
                                >
                                  {group.unitName}
                                </Badge>
                                <Badge variant="light" color="deniz" size="xs">
                                  {group.items.length} evrak
                                </Badge>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        )}
                        {group.items.map((d) => {
                          const isSelected = selectedDistIds.has(d.distribution_id)
                          return (
                            <Table.Tr
                              key={d.distribution_id}
                              style={{
                                cursor: 'pointer',
                                background: isSelected ? theme.colors.deniz[0] : undefined
                              }}
                              onClick={() => handleToggleRow(d.distribution_id)}
                            >
                              <Table.Td style={{ textAlign: 'center' }}>
                                <Checkbox
                                  checked={isSelected}
                                  onChange={() => handleToggleRow(d.distribution_id)}
                                  size="xs"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </Table.Td>
                              <Table.Td fw={600}>{d.document_id}</Table.Td>
                              <Table.Td>{getScopeBadge(d.document_scope)}</Table.Td>
                              <Table.Td>{d.source_office}</Table.Td>
                              <Table.Td>{d.reference_number}</Table.Td>
                              <Table.Td>{d.subject}</Table.Td>
                              <Table.Td>{formatDate(d.document_date)}</Table.Td>
                              <Table.Td>{getClassificationName(d.classification_id)}</Table.Td>
                              <Table.Td>{d.security_control_no || '—'}</Table.Td>
                              <Table.Td>{formatDate(d.record_date)}</Table.Td>
                            </Table.Tr>
                          )
                        })}
                      </React.Fragment>
                    ))
                  })()}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Box>

        {/* Alt butonlar */}
        {pendingList.length > 0 && (
          <Group justify="flex-end" mt="sm">
            <Button
              leftSection={<IconCheck size={16} />}
              rightSection={<IconPrinter size={16} />}
              onClick={handleDeliver}
              loading={delivering}
              disabled={selectedDistIds.size === 0}
              color="teal"
              size="sm"
            >
              Teslim Et ve Yazdır ({selectedDistIds.size})
            </Button>
          </Group>
        )}
      </Card>

      {/* Senet yazdırma (gizli portal) */}
      {printData && (
        <ReceiptPrintView
          data={printData}
          classifications={classifications}
          targetUnitName={
            selectedUnitIds[0]
              ? units.find((u) => u.id === selectedUnitIds[0])?.short_name ||
                units.find((u) => u.id === selectedUnitIds[0])?.name ||
                ''
              : ''
          }
          onClose={() => {
            setPrintData(null)
            setPrinting(false)
          }}
        />
      )}

      {/* Çakışma uyarı modalı */}
      <Modal
        opened={conflictModalOpen}
        onClose={() => {
          setConflictModalOpen(false)
          setConflictData(null)
          refreshList()
        }}
        title={
          <Group gap="xs">
            <IconAlertTriangle size={20} color={theme.colors.yellow[6]} />
            <Text fw={700} size="sm">
              Çakışma Uyarısı
            </Text>
          </Group>
        }
        size="lg"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Aşağıdaki evraklar, <strong>başka bir kullanıcı tarafından zaten teslim edilmiş</strong>
            . Bu evraklar senedinize dahil edilemez:
          </Text>

          <ScrollArea.Autosize mah={250}>
            <Table striped highlightOnHover fz="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>K.No</Table.Th>
                  <Table.Th>Konusu</Table.Th>
                  <Table.Th>Teslim Eden</Table.Th>
                  <Table.Th>Senet No</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {conflictData?.failed.map((f) => (
                  <Table.Tr key={f.distribution_id}>
                    <Table.Td fw={600}>{f.document_id ?? '—'}</Table.Td>
                    <Table.Td>{f.subject ?? '—'}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="orange" size="sm">
                        {f.already_delivered_by ?? 'Bilinmiyor'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{f.already_receipt_no ?? '—'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>

          {conflictData && conflictData.delivered.length > 0 && (
            <Text size="sm" c="dimmed">
              Kalan <strong>{conflictData.delivered.length}</strong> evrak başarıyla teslim
              edilmiştir. Kabul ederseniz bu evraklar için senet yazdırılacak, reddetmeniz halinde
              sayfa yenilenecektir.
            </Text>
          )}

          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={handleConflictReject} size="sm">
              Reddet — Sayfayı Yenile
            </Button>
            {conflictData && conflictData.delivered.length > 0 && (
              <Button color="teal" onClick={handleConflictAccept} size="sm">
                Kabul Et — Senet Yazdır ({conflictData.delivered.length})
              </Button>
            )}
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}
