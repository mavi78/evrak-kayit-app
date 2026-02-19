// ============================================================
// PostalServicePage - Posta Servisi ana sayfası
//
// Sorumlulukları:
// 1. Bekleyenler Havuzu (hiyerarşik gruplama, çoklu seçim)
// 2. Geçmiş Zarflar (tablo, detay modalı)
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Tabs,
  Table,
  Checkbox,
  Button,
  Group,
  Text,
  Badge,
  Stack,
  Paper,
  Loader,
  Center,
  Title,
  Accordion,
  Alert
} from '@mantine/core'
import { IconMailbox, IconHistory, IconMail, IconInfoCircle } from '@tabler/icons-react'
import type { PendingPostalDistribution, PostalEnvelopeDetail } from '@shared/types'
import { postalEnvelopeApi } from '@renderer/lib/api'
import { showError } from '@renderer/lib/notifications'
import CreateEnvelopeModal from './CreateEnvelopeModal'

/** Hiyerarşik grup yapısı — Üst Birim → Alt Birimler düzeninde */
interface UnitGroup {
  groupName: string
  groupId: number | null // parent_unit_id || unit_id
  items: PendingPostalDistribution[]
}

export default function PostalServicePage(): React.JSX.Element {
  // ---- Bekleyenler state ----
  const [pending, setPending] = useState<PendingPostalDistribution[]>([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [createModalOpened, setCreateModalOpened] = useState(false)

  // ---- Geçmiş state ----
  const [envelopes, setEnvelopes] = useState<PostalEnvelopeDetail[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [editingEnvelope, setEditingEnvelope] = useState<PostalEnvelopeDetail | null>(null)

  const [activeTab, setActiveTab] = useState<string | null>('pending')

  // ---- Veri çekme ----
  const fetchPending = useCallback(async (): Promise<void> => {
    setPendingLoading(true)
    const response = await postalEnvelopeApi.getPending()
    if (response.success) {
      setPending(response.data)
    } else {
      showError(response.message)
    }
    setPendingLoading(false)
  }, [])

  const fetchHistory = useCallback(async (): Promise<void> => {
    setHistoryLoading(true)
    const response = await postalEnvelopeApi.getAllEnvelopes()
    if (response.success) {
      setEnvelopes(response.data)
    } else {
      showError(response.message)
    }
    setHistoryLoading(false)
  }, [])

  useEffect(() => {
    void (async () => {
      await fetchPending()
    })()
  }, [fetchPending])

  useEffect(() => {
    if (activeTab === 'history') {
      void (async () => {
        await fetchHistory()
      })()
    }
  }, [activeTab, fetchHistory])

  // ---- Hiyerarşik gruplama ----
  const groups: UnitGroup[] = useMemo(() => {
    const map = new Map<string, UnitGroup>()
    for (const item of pending) {
      const groupKey = item.parent_unit_name ?? item.unit_name
      const groupId = item.parent_unit_id ?? item.unit_id
      if (!map.has(groupKey)) {
        map.set(groupKey, { groupName: groupKey, groupId, items: [] })
      }
      map.get(groupKey)!.items.push(item)
    }
    return Array.from(map.values())
  }, [pending])

  // ---- Seçim ----
  const toggleSelect = (distId: number): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(distId)) next.delete(distId)
      else next.add(distId)
      return next
    })
  }

  const toggleGroupSelect = (group: UnitGroup): void => {
    const groupDistIds = group.items.map((i) => i.distribution_id)
    const allSelected = groupDistIds.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        groupDistIds.forEach((id) => next.delete(id))
      } else {
        groupDistIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const toggleSelectAll = (): void => {
    if (selectedIds.size === pending.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pending.map((p) => p.distribution_id)))
    }
  }

  const selectedDistributions = useMemo(
    () => pending.filter((p) => selectedIds.has(p.distribution_id)),
    [pending, selectedIds]
  )

  // ---- Zarf oluşturma/güncelleme başarılı ----
  const handleEnvelopeCreated = (): void => {
    setSelectedIds(new Set())
    void fetchPending()
    void fetchHistory()
  }

  // ---- Tarih formatlama ----
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

  return (
    <>
      <Title order={3} mb="sm">
        Posta Servisi
      </Title>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="pending" leftSection={<IconMailbox size={16} />}>
            Bekleyenler Havuzu
            {pending.length > 0 && (
              <Badge size="xs" variant="filled" color="red" ml={6}>
                {pending.length}
              </Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
            Geçmiş Zarflar
          </Tabs.Tab>
        </Tabs.List>

        {/* ==================== BEKLEYENLER HAVUZU ==================== */}
        <Tabs.Panel value="pending">
          {pendingLoading ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : pending.length === 0 ? (
            <Alert
              icon={<IconInfoCircle size={16} />}
              title="Bekleyen Evrak Yok"
              color="blue"
              variant="light"
            >
              Posta kanalıyla dağıtılmış ve henüz zarflanmamış evrak bulunmamaktadır.
            </Alert>
          ) : (
            <Stack gap="sm">
              {/* Toplu seçim + Zarf oluştur butonları */}
              <Group justify="space-between">
                <Group gap="xs">
                  <Checkbox
                    label={`Tümünü Seç (${pending.length})`}
                    checked={selectedIds.size === pending.length}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < pending.length}
                    onChange={toggleSelectAll}
                    size="xs"
                  />
                  {selectedIds.size > 0 && (
                    <Badge variant="light" color="blue">
                      {selectedIds.size} seçili
                    </Badge>
                  )}
                </Group>
                <Button
                  leftSection={<IconMail size={16} />}
                  disabled={selectedIds.size === 0}
                  onClick={() => setCreateModalOpened(true)}
                  size="sm"
                >
                  Zarf Oluştur
                </Button>
              </Group>

              {/* Hiyerarşik gruplar */}
              <Accordion multiple defaultValue={groups.map((g) => g.groupName)} variant="separated">
                {groups.map((group) => {
                  const groupDistIds = group.items.map((i) => i.distribution_id)
                  const allGroupSelected = groupDistIds.every((id) => selectedIds.has(id))
                  const someGroupSelected = groupDistIds.some((id) => selectedIds.has(id))

                  return (
                    <Accordion.Item key={group.groupName} value={group.groupName}>
                      <Accordion.Control>
                        <Group gap="xs">
                          <Checkbox
                            checked={allGroupSelected}
                            indeterminate={someGroupSelected && !allGroupSelected}
                            onChange={() => toggleGroupSelect(group)}
                            onClick={(e) => e.stopPropagation()}
                            size="xs"
                          />
                          <Text fw={600} size="sm">
                            {group.groupName}
                          </Text>
                          <Badge size="xs" variant="light" color="gray">
                            {group.items.length} evrak
                          </Badge>
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Table fz="xs">
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th style={{ width: 40 }} />
                              <Table.Th>K.No</Table.Th>
                              <Table.Th>Sayı</Table.Th>
                              <Table.Th>Konu</Table.Th>
                              <Table.Th>Birim</Table.Th>
                              <Table.Th>Kayıt Tarihi</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {group.items.map((item) => (
                              <Table.Tr
                                key={item.distribution_id}
                                bg={selectedIds.has(item.distribution_id) ? 'blue.0' : undefined}
                                style={{ cursor: 'pointer' }}
                                onClick={() => toggleSelect(item.distribution_id)}
                              >
                                <Table.Td>
                                  <Checkbox
                                    checked={selectedIds.has(item.distribution_id)}
                                    onChange={() => toggleSelect(item.distribution_id)}
                                    onClick={(e) => e.stopPropagation()}
                                    size="xs"
                                  />
                                </Table.Td>
                                <Table.Td>{item.document_id}</Table.Td>
                                <Table.Td>{item.document_reference_number}</Table.Td>
                                <Table.Td>{item.document_subject}</Table.Td>
                                <Table.Td>
                                  <Badge size="xs" variant="light">
                                    {item.unit_name}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>{item.document_record_date}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </Accordion.Panel>
                    </Accordion.Item>
                  )
                })}
              </Accordion>
            </Stack>
          )}
        </Tabs.Panel>

        {/* ==================== GEÇMİŞ ZARFLAR ==================== */}
        <Tabs.Panel value="history">
          {historyLoading ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : envelopes.length === 0 ? (
            <Alert
              icon={<IconInfoCircle size={16} />}
              title="Geçmiş Zarf Yok"
              color="blue"
              variant="light"
            >
              Henüz oluşturulmuş posta zarfı bulunmamaktadır.
            </Alert>
          ) : (
            <Paper withBorder>
              <Table fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Zarf No</Table.Th>
                    <Table.Th>Alıcı</Table.Th>
                    <Table.Th>Postalanma Tarihi</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Toplam Maliyet</Table.Th>
                    <Table.Th style={{ textAlign: 'center' }}>Evrak Sayısı</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {envelopes.map((env) => (
                    <Table.Tr
                      key={env.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setEditingEnvelope(env)
                        setCreateModalOpened(true)
                      }}
                    >
                      <Table.Td>
                        <Badge variant="filled" size="sm">
                          #{env.id}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{env.recipient_name}</Table.Td>
                      <Table.Td>{formatDate(env.created_at)}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text fw={600} c="blue">
                          {env.total_cost.toFixed(2)} TL
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Badge variant="light" color="gray">
                          {env.distributions.length}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Tabs.Panel>
      </Tabs>

      {/* Modallar */}
      <CreateEnvelopeModal
        opened={createModalOpened}
        onClose={() => {
          setCreateModalOpened(false)
          setEditingEnvelope(null)
        }}
        onSuccess={handleEnvelopeCreated}
        selectedDistributions={selectedDistributions}
        editingEnvelope={editingEnvelope}
      />
    </>
  )
}
