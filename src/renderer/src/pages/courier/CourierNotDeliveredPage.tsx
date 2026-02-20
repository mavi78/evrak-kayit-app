// ============================================================
// CourierNotDeliveredPage - Kurye ile teslim edilmeyen evraklar
//
// Akış:
// 1. UnitTreePicker ile birlik seç (tekli) → otomatik listele
// 2. Tablo: teslim edilmemiş kurye dağıtımları (checkbox)
//    - Alt birlikleri (rekürsif) varsa birlik adıyla gruplandırılır
// 3. Toplu / tekli seçim → "Teslim Et ve Yazdır"
// 4. Başarılı teslim → ReceiptPrintView modal açılır
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
  useMantineTheme
} from '@mantine/core'
import { IconPrinter, IconCheck } from '@tabler/icons-react'
import { UnitTreePicker } from '@renderer/components/common'
import { incomingDocumentApi, unitApi, classificationApi } from '@renderer/lib/api'
import { showError, showSuccess } from '@renderer/lib/notifications'
import { ReceiptPrintView } from '@renderer/components/common/ReceiptPrintView/ReceiptPrintView'
import type {
  Unit,
  Classification,
  CourierPendingDistribution,
  DeliveredReceiptInfo
} from '@shared/types'

const PAGE_DESCRIPTION =
  'Kurye kanalıyla dağıtılmış ve henüz teslim edilmemiş belgeleri birlik bazlı listeleyebilir, ' +
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

    /** Rekürsif olarak tüm alt birlikleri toplar */
    function collectDescendants(parentId: number): void {
      const children = units.filter((u) => u.parent_id === parentId && u.is_active)
      if (children.length > 0) {
        children.forEach((c) => {
          // Alt birliğin de altı var mı bak — rekürsif
          const grandChildren = units.filter((u) => u.parent_id === c.id && u.is_active)
          if (grandChildren.length > 0) {
            collectDescendants(c.id)
          } else {
            result.push(c.id)
          }
        })
      } else {
        // Alt birlik yoksa birliğin kendisini ekle
        result.push(parentId)
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

    incomingDocumentApi
      .courierPending(resolvedUnitIds)
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setPendingList(res.data)
        } else {
          showError(res.message)
          setPendingList([])
        }
      })
      .catch(() => {
        if (cancelled) return
        showError('Veri yüklenirken bir hata oluştu')
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

  // Teslim et
  const handleDeliver = useCallback(async () => {
    if (selectedDistIds.size === 0) {
      showError('Teslim edilecek en az bir evrak seçin')
      return
    }
    setDelivering(true)
    try {
      const res = await incomingDocumentApi.courierBulkDeliver({
        distribution_ids: Array.from(selectedDistIds)
      })
      if (res.success && res.data) {
        const { delivered, failed } = res.data
        if (delivered.length > 0) {
          showSuccess(`${delivered.length} evrak teslim edildi`)
          // Senet yazdırma verisi hazırla
          setPrintData(delivered)
          // Teslim edilen dağıtımları listeden çıkar
          setPendingList((prev) =>
            prev.filter((d) => !delivered.some((del) => del.distribution_id === d.distribution_id))
          )
          setSelectedDistIds(new Set())
        }
        if (failed.length > 0) {
          showError(`${failed.length} evrak teslim edilemedi`)
        }
      } else {
        showError(res.message)
      }
    } catch {
      showError('Teslim işlemi sırasında bir hata oluştu')
    } finally {
      setDelivering(false)
    }
  }, [selectedDistIds])

  // Yardımcılar

  const getClassificationName = useCallback(
    (classId: number): string => {
      const c = classifications.find((x) => x.id === classId)
      return c?.name ?? ''
    },
    [classifications]
  )

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        gap: 'var(--mantine-spacing-sm)'
      }}
    >
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
                              colSpan={9}
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

      {/* Senet yazdırma modal */}
      {printData && (
        <ReceiptPrintView
          data={printData}
          classifications={classifications}
          onClose={() => setPrintData(null)}
        />
      )}
    </Box>
  )
}
