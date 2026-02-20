// ============================================================
// CourierDeliveredPage - Teslim edilen kurye evrakları
//
// Geçmiş teslim kayıtlarını gösterir. Tekrar yazdırma imkanı sunar.
// Birlik seçimi ile filtreleme + alt birlik bazlı gruplandırma
// ============================================================

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Box,
  Card,
  Stack,
  Title,
  Text,
  Group,
  Table,
  Badge,
  ScrollArea,
  ActionIcon,
  TextInput,
  useMantineTheme
} from '@mantine/core'
import { IconPrinter, IconSearch, IconX } from '@tabler/icons-react'
import { incomingDocumentApi, unitApi, classificationApi } from '@renderer/lib/api'
import { showError } from '@renderer/lib/notifications'
import { ReceiptPrintView } from '@renderer/components/common/ReceiptPrintView/ReceiptPrintView'
import { UnitTreePicker } from '@renderer/components/common'
import type { DeliveredReceiptInfo, Classification, Unit } from '@shared/types'
import { normalizeForSearch } from '@shared/utils/searchUtils'

/** Tarih formatlama: YYYY-MM-DD → DD.MM.YYYY */
function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const parts = dateStr.split(/[- ]/)
  if (parts.length >= 3) {
    return parts[2] + '.' + parts[1] + '.' + parts[0]
  }
  return dateStr
}

/** Teslim tarihi formatlama */
function formatDeliveryDate(dateStr: string): string {
  if (!dateStr) return '—'
  const parts = dateStr.split(' ')
  const datePart = formatDate(parts[0])
  const timePart = parts[1] ? parts[1].substring(0, 5) : ''
  return timePart ? datePart + ' ' + timePart : datePart
}

export default function CourierDeliveredPage(): React.JSX.Element {
  const theme = useMantineTheme()

  const [deliveredList, setDeliveredList] = useState<DeliveredReceiptInfo[]>([])
  const [classifications, setClassifications] = useState<Classification[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Birlik seçimi (tekli)
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([])

  // Tekrar yazdırma
  const [printData, setPrintData] = useState<DeliveredReceiptInfo[] | null>(null)

  // Verileri yükle
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await incomingDocumentApi.courierDeliveredList()
      if (res.success) {
        setDeliveredList(res.data)
      } else {
        showError(res.message)
      }
    } catch {
      showError('Veriler yüklenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
    classificationApi.getAll().then((res) => {
      if (res.success) setClassifications(res.data)
    })
    unitApi.getAll().then((res) => {
      if (res.success) setUnits(res.data)
    })
  }, [loadData])

  // Sınıflandırma adı
  const getClassificationName = useCallback(
    (classId: number): string => {
      const c = classifications.find((x) => x.id === classId)
      return c?.name ?? ''
    },
    [classifications]
  )

  // Filtreleme: birlik (rekürsif alt birlikleriyle) + metin arama
  const filteredList = useMemo(() => {
    let list = deliveredList

    // Birlik filtresi — seçilen birliğin tüm alt birlikleri (rekürsif, ucuna kadar)
    if (selectedUnitIds.length > 0) {
      const selectedId = selectedUnitIds[0]
      const validNames = new Set<string>()

      /** Rekürsif olarak tüm alt birlik adlarını topla */
      function collectDescendantNames(parentId: number): void {
        const children = units.filter((u) => u.parent_id === parentId && u.is_active)
        if (children.length > 0) {
          children.forEach((c) => {
            const grandChildren = units.filter((u) => u.parent_id === c.id && u.is_active)
            if (grandChildren.length > 0) {
              collectDescendantNames(c.id)
            } else {
              validNames.add(c.short_name || c.name)
            }
          })
        } else {
          // Yaprak birlik — kendisini ekle
          const u = units.find((x) => x.id === parentId)
          if (u) validNames.add(u.short_name || u.name)
        }
      }

      collectDescendantNames(selectedId)

      // Seçilen birliğin kendisini de dahil et
      const selectedUnit = units.find((u) => u.id === selectedId)
      if (selectedUnit) {
        validNames.add(selectedUnit.short_name || selectedUnit.name)
      }

      list = list.filter((d) => validNames.has(d.unit_name))
    }

    // Metin arama
    if (searchQuery.trim()) {
      const q = normalizeForSearch(searchQuery)
      list = list.filter(
        (d) =>
          normalizeForSearch(d.source_office).includes(q) ||
          normalizeForSearch(d.reference_number).includes(q) ||
          normalizeForSearch(d.subject).includes(q) ||
          normalizeForSearch(d.unit_name).includes(q) ||
          String(d.receipt_no).includes(q) ||
          String(d.document_id).includes(q)
      )
    }

    return list
  }, [deliveredList, searchQuery, selectedUnitIds, units])

  // Alt birlik bazlı gruplandırma (dinamik, unit_name bazlı)
  const groupedData = useMemo(() => {
    const selectedId = selectedUnitIds[0] ?? null
    const selectedUnit = selectedId ? units.find((u) => u.id === selectedId) : null

    // unit_name bazlı grupla
    const groupMap = new Map<string, DeliveredReceiptInfo[]>()
    for (const d of filteredList) {
      const arr = groupMap.get(d.unit_name) ?? []
      arr.push(d)
      groupMap.set(d.unit_name, arr)
    }

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

    return { groups, showGroupHeaders }
  }, [filteredList, selectedUnitIds, units])

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
          Teslim Edilen
        </Title>
        <Text size="sm" c="dimmed">
          Kurye kanalıyla teslim edilmiş evrakların geçmiş kayıtları.
        </Text>
      </Stack>

      {/* Filtre kartı */}
      <Card
        withBorder
        shadow="sm"
        radius="md"
        padding="sm"
        style={{ flexShrink: 0, position: 'relative', zIndex: 20, overflow: 'visible' }}
      >
        <Group gap="sm" align="flex-end">
          <Box style={{ flex: 1 }}>
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
          <TextInput
            placeholder="Ara..."
            size="sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            rightSection={
              searchQuery ? (
                <ActionIcon size="xs" variant="subtle" onClick={() => setSearchQuery('')}>
                  <IconX size={12} />
                </ActionIcon>
              ) : (
                <IconSearch size={12} color={theme.colors.gray[5]} />
              )
            }
            style={{ width: 220 }}
          />
        </Group>
      </Card>

      {/* Tablo kartı */}
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
              TESLİM EDİLEN EVRAKLAR
            </Text>
            {filteredList.length > 0 && (
              <Badge variant="light" color="teal" size="sm">
                {filteredList.length} kayıt
              </Badge>
            )}
          </Group>
        </Group>

        <Box style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {loading ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              Yükleniyor...
            </Text>
          ) : filteredList.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              {deliveredList.length === 0
                ? 'Henüz teslim edilen kurye evrakı bulunmuyor.'
                : 'Aramanızla eşleşen kayıt bulunamadı.'}
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
                    background:
                      'linear-gradient(180deg, ' +
                      theme.colors.teal[4] +
                      ' 0%, ' +
                      theme.colors.teal[6] +
                      ' 50%, ' +
                      theme.colors.teal[8] +
                      ' 100%)'
                  },
                  th: {
                    padding: '6px 8px',
                    fontWeight: 800,
                    fontSize: '0.68rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: theme.colors.teal[0],
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
                    <Table.Th style={{ width: 55, borderTopLeftRadius: theme.radius.sm }}>
                      SENET NO
                    </Table.Th>
                    <Table.Th style={{ width: 55 }}>K.NO</Table.Th>
                    <Table.Th>GÖNDEREN MAKAM</Table.Th>
                    <Table.Th>SAYISI</Table.Th>
                    <Table.Th style={{ minWidth: 160 }}>KONUSU</Table.Th>
                    <Table.Th style={{ width: 80 }}>TARİHİ</Table.Th>
                    <Table.Th style={{ width: 70 }}>GİZLİLİK</Table.Th>
                    <Table.Th style={{ width: 80 }}>GÜV.K.NO</Table.Th>
                    <Table.Th style={{ width: 100 }}>KAYIT TARİHİ</Table.Th>
                    <Table.Th style={{ width: 100 }}>TESLİM TARİHİ</Table.Th>
                    <Table.Th
                      style={{
                        width: 45,
                        textAlign: 'center',
                        borderTopRightRadius: theme.radius.sm
                      }}
                    >
                      YAZDIR
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {groupedData.groups.map((group) => (
                    <React.Fragment key={group.unitName || '__all__'}>
                      {/* Birlik başlık satırı — Badge ile belirgin */}
                      {groupedData.showGroupHeaders && group.unitName && (
                        <Table.Tr>
                          <Table.Td
                            colSpan={11}
                            style={{
                              background: theme.colors.teal[0],
                              padding: '6px 8px',
                              borderBottom: '2px solid ' + theme.colors.teal[3]
                            }}
                          >
                            <Group gap="xs">
                              <Badge
                                variant="filled"
                                color="teal"
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
                              <Badge variant="light" color="teal" size="xs">
                                {group.items.length} evrak
                              </Badge>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      )}
                      {group.items.map((d) => (
                        <Table.Tr key={d.distribution_id}>
                          <Table.Td fw={700} style={{ textAlign: 'center' }}>
                            {d.receipt_no ?? '—'}
                          </Table.Td>
                          <Table.Td fw={600}>{d.document_id}</Table.Td>
                          <Table.Td>{d.source_office}</Table.Td>
                          <Table.Td>{d.reference_number}</Table.Td>
                          <Table.Td>{d.subject}</Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}>
                            {formatDate(d.document_date)}
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}>
                            {getClassificationName(d.classification_id)}
                          </Table.Td>
                          <Table.Td>{d.security_control_no || '—'}</Table.Td>
                          <Table.Td>{formatDate(d.record_date)}</Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}>
                            {formatDeliveryDate(d.delivery_date)}
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}>
                            <ActionIcon
                              variant="light"
                              color="teal"
                              size="xs"
                              onClick={() => setPrintData([d])}
                              title="Yazdır"
                            >
                              <IconPrinter size={14} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </React.Fragment>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Box>
      </Card>

      {/* Senet yazdırma */}
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
