// ============================================================
// IncomingDocumentsPage - Gelen evrak listesi
// Üst: sayfa başlığı + açıklama
// Arama kartı: arama + Yeni Evrak butonu (label yok)
// GELEN EVRAK LİSTESİ kartı: tablo
// Alt: HAVALE/DAĞITIM kartı (seçili evrakın dağıtımları)
// ============================================================

import { useState, useCallback, useEffect } from 'react'
import { Box, Card, Stack, Title, Text, Group, Select, Pagination } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  DocumentTable,
  DocumentSearchBar,
  DocumentFormModal
} from '@renderer/components/common'
import { useDocumentSearch } from '@renderer/hooks/useDocumentSearch'
import {
  incomingDocumentApi,
  classificationApi,
  unitApi
} from '@renderer/lib/api'
import { showError } from '@renderer/lib/notifications'
import { getIncomingDocumentColumns } from './incomingDocumentColumns'
import { DistributionTable } from './DistributionTable'
import type {
  IncomingDocument,
  IncomingDocumentDistribution,
  Classification,
  Unit
} from '@shared/types'

const PAGE_DESCRIPTION =
  'Gelen evrakları listeleyebilir, arayabilir ve yeni evrak kaydı oluşturabilirsiniz. ' +
  'Satıra tıklayarak evrakın havale/dağıtım bilgilerini görebilirsiniz.'

const PAGE_SIZE_OPTIONS = [
  { value: '20', label: '20' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: '200', label: '200' }
]

export default function IncomingDocumentsPage(): React.JSX.Element {
  const [list, setList] = useState<IncomingDocument[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [recordNoSearch, setRecordNoSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [classifications, setClassifications] = useState<Classification[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [selectedDoc, setSelectedDoc] = useState<IncomingDocument | null>(null)
  const [distributions, setDistributions] = useState<IncomingDocumentDistribution[]>([])
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false)

  const fetchList = useCallback(
    async (params: {
      recordNo?: number
      query?: string
      page: number
      pageSize: number
    }): Promise<void> => {
      setLoading(true)
      const res = await incomingDocumentApi.list(params)
      if (res.success && res.data) {
        setList(res.data.data)
        setTotal(res.data.total)
        setPage(res.data.page)
        setPageSize(res.data.pageSize)
      } else {
        showError(res.message)
      }
      setLoading(false)
    },
    []
  )

  const fetchAll = useCallback(() => {
    void fetchList({ page: 1, pageSize })
  }, [fetchList, pageSize])

  const fetchSearch = useCallback(
    (params: { recordNo?: number; query?: string }) => {
      void fetchList({ ...params, page: 1, pageSize })
    },
    [fetchList, pageSize]
  )

  const loadDistributions = useCallback(
    async (docId: number): Promise<void> => {
      const res = await incomingDocumentApi.getDistributions(docId)
      if (res.success) setDistributions(res.data)
      else setDistributions([])
    },
    []
  )

  useDocumentSearch({
    recordNoValue: recordNoSearch,
    query: searchQuery,
    minChars: 3,
    debounceMs: 300,
    onEmptySearch: fetchAll,
    onSearch: fetchSearch
  })

  useEffect(() => {
    classificationApi.getAll().then((res) => {
      if (res.success) setClassifications(res.data)
    })
    unitApi.getAll().then((res) => {
      if (res.success) setUnits(res.data)
    })
  }, [])

  const handleRowClick = useCallback(
    (row: IncomingDocument): void => {
      setSelectedDoc(row)
      void loadDistributions(row.id)
    },
    [loadDistributions]
  )

  const columns = getIncomingDocumentColumns(classifications)

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
      {/* Sayfa başlığı ve açıklama */}
      <Stack gap={4}>
        <Title order={3} style={{ margin: 0 }}>
          Gelen Evrak
        </Title>
        <Text size="sm" c="dimmed" style={{ maxWidth: 560 }}>
          {PAGE_DESCRIPTION}
        </Text>
      </Stack>

      {/* Arama ve Yeni Evrak butonu — ayrı kart */}
      <Card withBorder shadow="sm" radius="md" padding="xs" style={{ flexShrink: 0 }}>
        <DocumentSearchBar
          recordNoValue={recordNoSearch}
          onRecordNoChange={setRecordNoSearch}
          value={searchQuery}
          onChange={setSearchQuery}
          onNewDocumentClick={openModal}
          onSearchSubmit={({ recordNo, query }) => {
            if (!recordNo && !query) void fetchAll()
            else {
              const rn = recordNo ? parseInt(recordNo, 10) : undefined
              void fetchSearch({
                recordNo: rn && !Number.isNaN(rn) ? rn : undefined,
                query: query || undefined
              })
            }
          }}
          newButtonLabel="Yeni Evrak"
          searchPlaceholder="Makam, sayı, konu, tarih ile ara (min. 3 karakter veya Enter)"
        />
      </Card>

      {/* GELEN EVRAK LİSTESİ kartı */}
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
        <Text fw={700} size="sm" mb="xs" tt="uppercase">
          GELEN EVRAK LİSTESİ
        </Text>
        <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <DocumentTable<IncomingDocument>
            columns={columns}
            data={list}
            loading={loading}
            onRowClick={handleRowClick}
            emptyMessage="Henüz kayıt yok."
            selectedRowId={selectedDoc?.id}
          />
          {total > 0 && (
            <Group justify="space-between" mt="xs" wrap="wrap" gap="xs">
              <Group gap="xs" align="center">
                <Text size="xs" c="dimmed">
                  Sayfa başına:
                </Text>
                <Select
                  size="xs"
                  w={70}
                  data={PAGE_SIZE_OPTIONS}
                  value={String(pageSize)}
                  onChange={(v) => {
                    const newSize = v ? parseInt(v, 10) : 20
                    setPageSize(newSize)
                    const rn = recordNoSearch.trim()
                      ? parseInt(recordNoSearch, 10)
                      : undefined
                    void fetchList({
                      recordNo: rn && !Number.isNaN(rn) ? rn : undefined,
                      query: searchQuery.trim() || undefined,
                      page: 1,
                      pageSize: newSize
                    })
                  }}
                />
                <Text size="xs" c="dimmed">
                  Toplam: {total}
                </Text>
              </Group>
              <Pagination
                size="xs"
                value={page}
                onChange={(p) => {
                  setPage(p)
                  const rn = recordNoSearch.trim()
                    ? parseInt(recordNoSearch, 10)
                    : undefined
                  void fetchList({
                    recordNo: rn && !Number.isNaN(rn) ? rn : undefined,
                    query: searchQuery.trim() || undefined,
                    page: p,
                    pageSize
                  })
                }}
                total={Math.ceil(total / pageSize) || 1}
                siblings={1}
                boundaries={1}
              />
            </Group>
          )}
        </Box>
      </Card>

      {/* HAVALE/DAĞITIM kartı - sayfa altında sabit */}
      <Card
        withBorder
        shadow="sm"
        radius="md"
        padding="sm"
        style={{ flexShrink: 0 }}
      >
        <Text fw={700} size="sm" mb="xs" tt="uppercase">
          HAVALE/DAĞITIM
        </Text>
        <DistributionTable distributions={distributions} units={units} />
      </Card>

      <DocumentFormModal
        opened={modalOpened}
        onClose={closeModal}
        onSuccess={fetchAll}
        scope="INCOMING"
      />
    </Box>
  )
}
