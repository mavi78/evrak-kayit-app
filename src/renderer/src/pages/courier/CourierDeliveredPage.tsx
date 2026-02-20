// ============================================================
// CourierDeliveredPage - Teslim edilen kurye evrakları
//
// Geçmiş teslim kayıtlarını SENET NUMARASI bazlı gruplandırarak gösterir.
// Tarih aralığı (varsayılan: bugün) + birlik seçimi ile filtreleme.
// Tekrar yazdırma senet grubu üzerinden yapılır.
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
  Collapse,
  TextInput,
  useMantineTheme
} from '@mantine/core'
import { IconPrinter, IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { incomingDocumentApi, unitApi, classificationApi } from '@renderer/lib/api'
import { showError } from '@renderer/lib/notifications'
import { ReceiptPrintView } from '@renderer/components/common/ReceiptPrintView/ReceiptPrintView'
import { UnitTreePicker } from '@renderer/components/common'
import type { DeliveredReceiptInfo, Classification, Unit } from '@shared/types'

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

/** Date nesnesini YYYY-MM-DD string'e çevir */
function toIsoDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Senet grubunun tüm birlik adlarını benzersiz olarak birleştir */
function getUniqueUnitNames(items: DeliveredReceiptInfo[]): string {
  const names = new Set(items.map((i) => i.unit_name))
  return Array.from(names).join(', ')
}

/** Senet numarası bazlı grup tipi */
interface ReceiptGroup {
  receiptNo: number | null
  items: DeliveredReceiptInfo[]
  unitNames: string
  deliveryDate: string
  deliveredByName: string | null
}

export default function CourierDeliveredPage(): React.JSX.Element {
  const theme = useMantineTheme()

  const [deliveredList, setDeliveredList] = useState<DeliveredReceiptInfo[]>([])
  const [classifications, setClassifications] = useState<Classification[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(false)

  // Tarih filtresi — varsayılan: bugün (YYYY-MM-DD string)
  const todayStr = toIsoDateStr(new Date())
  const [dateFrom, setDateFrom] = useState<string>(todayStr)
  const [dateTo, setDateTo] = useState<string>(todayStr)

  // Birlik seçimi (tekli)
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([])

  // Tekrar yazdırma
  const [printData, setPrintData] = useState<DeliveredReceiptInfo[] | null>(null)

  // Açık/kapalı senet grupları
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Referans verileri yükle (bir kez)
  useEffect(() => {
    classificationApi.getAll().then((res) => {
      if (res.success) setClassifications(res.data)
    })
    unitApi.getAll().then((res) => {
      if (res.success) setUnits(res.data)
    })
  }, [])

  // Birlik seçimine göre alt birlikleri belirleme mantığı (rekürsif)
  const resolvedUnitIds = useMemo(() => {
    if (selectedUnitIds.length === 0) return []

    const result: number[] = []

    function collectDescendants(parentId: number): void {
      const children = units.filter((u) => u.parent_id === parentId && u.is_active)
      if (children.length > 0) {
        children.forEach((c) => {
          const grandChildren = units.filter((u) => u.parent_id === c.id && u.is_active)
          if (grandChildren.length > 0) {
            collectDescendants(c.id)
          } else {
            result.push(c.id)
          }
        })
      } else {
        result.push(parentId)
      }
    }

    for (const uid of selectedUnitIds) {
      collectDescendants(uid)
    }
    return [...new Set(result)]
  }, [selectedUnitIds, units])

  // Verileri yükle (tarih/birlik değiştiğinde)
  const loadData = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setLoading(true)
    try {
      const res = await incomingDocumentApi.courierDeliveredList({
        date_from: dateFrom,
        date_to: dateTo,
        unit_ids: resolvedUnitIds.length > 0 ? resolvedUnitIds : undefined
      })
      if (res.success) {
        setDeliveredList(res.data)
      } else {
        showError(res.message)
        setDeliveredList([])
      }
    } catch {
      showError('Veriler yüklenirken hata oluştu')
      setDeliveredList([])
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, resolvedUnitIds])

  // Tarih veya birlik değişince otomatik yükle
  useEffect(() => {
    void loadData()
  }, [loadData])

  // Sınıflandırma adı
  const getClassificationName = useCallback(
    (classId: number): string => {
      const c = classifications.find((x) => x.id === classId)
      return c?.name ?? ''
    },
    [classifications]
  )

  // Senet numarası bazlı gruplama
  const receiptGroups = useMemo((): ReceiptGroup[] => {
    const groupMap = new Map<string, DeliveredReceiptInfo[]>()

    for (const d of deliveredList) {
      const key = d.receipt_no != null ? String(d.receipt_no) : `no-receipt-${d.distribution_id}`
      const arr = groupMap.get(key) ?? []
      arr.push(d)
      groupMap.set(key, arr)
    }

    return Array.from(groupMap.entries()).map(([, items]) => ({
      receiptNo: items[0].receipt_no,
      items,
      unitNames: getUniqueUnitNames(items),
      deliveryDate: items[0].delivery_date,
      deliveredByName: items[0].delivered_by_name
    }))
  }, [deliveredList])

  // Toplam senet ve evrak sayısı
  const totalReceipts = receiptGroups.length
  const totalDocs = deliveredList.length

  // Grup aç/kapat toggle
  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Tüm grupları aç/kapat
  const allExpanded = expandedGroups.size === receiptGroups.length && receiptGroups.length > 0
  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setExpandedGroups(new Set())
    } else {
      setExpandedGroups(new Set(receiptGroups.map((g) => String(g.receiptNo ?? 'null'))))
    }
  }, [allExpanded, receiptGroups])

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
          Kurye kanalıyla teslim edilmiş evrakları senet numarası bazlı listeleyin ve tekrar
          yazdırın.
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
          <TextInput
            label="Başlangıç Tarihi"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.currentTarget.value)}
            size="xs"
            style={{ width: 160 }}
          />
          <TextInput
            label="Bitiş Tarihi"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.currentTarget.value)}
            size="xs"
            style={{ width: 160 }}
          />
          <Box style={{ flex: 1 }}>
            <Text size="xs" fw={600} c="dimmed" mb={4}>
              Birlik Seçimi (Opsiyonel)
            </Text>
            <UnitTreePicker
              units={units}
              values={selectedUnitIds}
              onChange={setSelectedUnitIds}
              singleSelect
            />
          </Box>
        </Group>
      </Card>

      {/* Senet listesi kartı */}
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
              TESLİM EDİLEN SENETLER
            </Text>
            {totalReceipts > 0 && (
              <>
                <Badge variant="light" color="teal" size="sm">
                  {totalReceipts} senet
                </Badge>
                <Badge variant="light" color="gray" size="sm">
                  {totalDocs} evrak
                </Badge>
              </>
            )}
          </Group>
          {receiptGroups.length > 0 && (
            <Text
              size="xs"
              c="teal"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={toggleAll}
              fw={600}
            >
              {allExpanded ? 'Tümünü Kapat' : 'Tümünü Aç'}
            </Text>
          )}
        </Group>

        <Box style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {loading ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              Yükleniyor...
            </Text>
          ) : receiptGroups.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              {dateFrom
                ? 'Seçilen tarih aralığında teslim edilmiş kurye senedi bulunamadı.'
                : 'Tarih seçerek teslim edilmiş senetleri görüntüleyin.'}
            </Text>
          ) : (
            <ScrollArea h="100%" scrollbarSize={6} type="hover">
              <Stack gap={0}>
                {receiptGroups.map((group) => {
                  const groupKey = String(group.receiptNo ?? 'null')
                  const isExpanded = expandedGroups.has(groupKey)

                  return (
                    <Box key={groupKey}>
                      {/* Senet başlık satırı */}
                      <Group
                        gap="xs"
                        px="sm"
                        py={6}
                        style={{
                          cursor: 'pointer',
                          borderBottom: `1px solid ${theme.colors.gray[2]}`,
                          background: isExpanded ? theme.colors.teal[0] : 'transparent',
                          borderRadius: isExpanded
                            ? `${theme.radius.sm} ${theme.radius.sm} 0 0`
                            : theme.radius.sm,
                          transition: 'background 150ms ease'
                        }}
                        onClick={() => toggleGroup(groupKey)}
                      >
                        {isExpanded ? (
                          <IconChevronDown size={16} color={theme.colors.teal[6]} />
                        ) : (
                          <IconChevronRight size={16} color={theme.colors.gray[5]} />
                        )}

                        <Badge variant="filled" color="teal" size="sm" radius="sm" fw={800}>
                          Senet No: {group.receiptNo ?? '—'}
                        </Badge>

                        <Badge variant="light" color="blue" size="xs">
                          {group.unitNames}
                        </Badge>

                        <Badge variant="light" color="gray" size="xs">
                          {group.items.length} evrak
                        </Badge>

                        <Text size="xs" c="dimmed" style={{ marginLeft: 'auto' }}>
                          {formatDeliveryDate(group.deliveryDate)}
                        </Text>

                        {group.deliveredByName && (
                          <Badge variant="light" color="orange" size="xs">
                            {group.deliveredByName}
                          </Badge>
                        )}

                        <ActionIcon
                          variant="light"
                          color="teal"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPrintData(group.items)
                          }}
                          title="Bu senete ait tüm belgeleri yazdır"
                        >
                          <IconPrinter size={14} />
                        </ActionIcon>
                      </Group>

                      {/* Genişletilmiş belge listesi */}
                      <Collapse in={isExpanded}>
                        <Box
                          style={{
                            borderLeft: `3px solid ${theme.colors.teal[3]}`,
                            borderRight: `1px solid ${theme.colors.gray[2]}`,
                            borderBottom: `1px solid ${theme.colors.gray[2]}`,
                            borderRadius: `0 0 ${theme.radius.sm} ${theme.radius.sm}`,
                            marginBottom: 4
                          }}
                        >
                          <Table
                            striped
                            highlightOnHover
                            fz="xs"
                            styles={{
                              table: { borderCollapse: 'separate', borderSpacing: 0 },
                              thead: {
                                background: `linear-gradient(180deg, ${theme.colors.teal[4]} 0%, ${theme.colors.teal[6]} 100%)`
                              },
                              th: {
                                padding: '5px 8px',
                                fontWeight: 800,
                                fontSize: '0.65rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: theme.colors.teal[0],
                                background: 'transparent',
                                borderBottom: 'none',
                                whiteSpace: 'nowrap'
                              },
                              td: {
                                padding: '4px 8px',
                                fontSize: '0.7rem'
                              }
                            }}
                          >
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th style={{ width: 55 }}>K.NO</Table.Th>
                                <Table.Th>GÖNDEREN MAKAM</Table.Th>
                                <Table.Th>SAYISI</Table.Th>
                                <Table.Th style={{ minWidth: 140 }}>KONUSU</Table.Th>
                                <Table.Th style={{ width: 80 }}>TARİHİ</Table.Th>
                                <Table.Th style={{ width: 70 }}>GİZLİLİK</Table.Th>
                                <Table.Th style={{ width: 80 }}>GÜV.K.NO</Table.Th>
                                <Table.Th style={{ width: 90 }}>KAYIT TARİHİ</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {group.items.map((d) => (
                                <Table.Tr key={d.distribution_id}>
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
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        </Box>
                      </Collapse>
                    </Box>
                  )
                })}
              </Stack>
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
