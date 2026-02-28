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
  LoadingOverlay,
  useMantineTheme
} from '@mantine/core'
import { IconPrinter, IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import {
  incomingDocumentApi,
  outgoingDocumentApi,
  transitDocumentApi,
  unitApi,
  classificationApi
} from '@renderer/lib/api'
import { showError } from '@renderer/lib/notifications'
import { ReceiptPrintView } from '@renderer/components/common/ReceiptPrintView/ReceiptPrintView'
import { UnitTreePicker } from '@renderer/components/common'
import type { DeliveredReceiptInfo, Classification, Unit } from '@shared/types'

const PAGE_DESCRIPTION =
  'Gelen, Giden ve Transit evraklara ait, kurye kanalıyla teslim edilmiş belgeleri senet numarası bazlı listeleyin ve ' +
  'tekrar yazdırın.'

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

/**
 * Senet yazdırma için birlik adı belirle:
 * - Tüm unit_id'ler aynıysa → o birliğin kısa adı
 * - Farklıysa → ortak üst birlik (LCA) adı
 */
function resolveReceiptUnitName(items: DeliveredReceiptInfo[], units: Unit[]): string {
  if (items.length === 0) return ''
  const unitIds = [...new Set(items.map((i) => i.unit_id))]
  if (unitIds.length === 1) {
    const u = units.find((x) => x.id === unitIds[0])
    return u?.short_name || u?.name || items[0].unit_name || ''
  }
  // Ortak üst birlik bul (LCA — Lowest Common Ancestor)
  function getAncestorPath(uid: number): number[] {
    const path: number[] = []
    let current: number | null = uid
    while (current != null) {
      path.unshift(current)
      const unit = units.find((u) => u.id === current)
      if (!unit?.parent_id) break
      current = unit.parent_id
    }
    return path
  }
  const paths = unitIds.map((id) => getAncestorPath(id))
  let lcaId: number | null = null
  const minLen = Math.min(...paths.map((p) => p.length))
  for (let i = 0; i < minLen; i++) {
    if (paths.every((p) => p[i] === paths[0][i])) {
      lcaId = paths[0][i]
    } else {
      break
    }
  }
  if (lcaId != null) {
    const u = units.find((x) => x.id === lcaId)
    return u?.short_name || u?.name || ''
  }
  return ''
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
  const [printing, setPrinting] = useState(false)

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
    return [...new Set(result)]
  }, [selectedUnitIds, units])

  // Verileri yükle (tarih/birlik değiştiğinde)
  const loadData = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setLoading(true)
    try {
      const filters = {
        date_from: dateFrom,
        date_to: dateTo,
        unit_ids: resolvedUnitIds.length > 0 ? resolvedUnitIds : undefined
      }

      const results = await Promise.allSettled([
        incomingDocumentApi.courierDeliveredList(filters),
        outgoingDocumentApi.courierDeliveredList(filters),
        transitDocumentApi.courierDeliveredList(filters)
      ])

      let allDelivered: DeliveredReceiptInfo[] = []
      let hasError = false

      results.forEach((res) => {
        if (res.status === 'fulfilled' && res.value.success) {
          allDelivered = [...allDelivered, ...res.value.data]
        } else {
          hasError = true
        }
      })

      if (hasError) {
        showError('Bazı kapsam verileri yüklenirken hata oluştu')
      }

      // Senet no ve document_id'ye göre sırala (hepsi birleşik)
      allDelivered.sort((a, b) => {
        if (a.receipt_no !== b.receipt_no) {
          return (b.receipt_no || 0) - (a.receipt_no || 0)
        }
        return (a.document_id || 0) - (b.document_id || 0)
      })

      setDeliveredList(allDelivered)
    } catch {
      showError('Veriler birleştirilirken hata oluştu')
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
          Teslim Edilen
        </Title>
        <Text size="sm" c="dimmed">
          {PAGE_DESCRIPTION}
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
                            setPrinting(true)
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
                                <Table.Th style={{ width: 80 }}>KAPSAM</Table.Th>
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
                                  <Table.Td>
                                    <Badge
                                      color={
                                        d.document_scope === 'INCOMING'
                                          ? 'blue'
                                          : d.document_scope === 'OUTGOING'
                                            ? 'orange'
                                            : d.document_scope === 'TRANSIT'
                                              ? 'grape'
                                              : 'gray'
                                      }
                                      variant="light"
                                      size="xs"
                                    >
                                      {d.document_scope === 'INCOMING'
                                        ? 'GELEN'
                                        : d.document_scope === 'OUTGOING'
                                          ? 'GİDEN'
                                          : d.document_scope === 'TRANSIT'
                                            ? 'TRANSİT'
                                            : d.document_scope}
                                    </Badge>
                                  </Table.Td>
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

      {/* Senet yazdırma (gizli portal) */}
      {printData && (
        <ReceiptPrintView
          data={printData}
          classifications={classifications}
          targetUnitName={resolveReceiptUnitName(printData, units)}
          onClose={() => {
            setPrintData(null)
            setPrinting(false)
          }}
        />
      )}
    </Box>
  )
}
