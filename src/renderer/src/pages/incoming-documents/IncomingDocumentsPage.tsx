// ============================================================
// IncomingDocumentsPage - Gelen evrak listesi
// Üst: sayfa başlığı + açıklama
// Arama kartı: arama + Yeni Evrak butonu (label yok)
// GELEN EVRAK LİSTESİ kartı: tablo
// Alt: HAVALE/DAĞITIM kartı (seçili evrakın dağıtımları)
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react'
import { Box, Card, Stack, Title, Text, Group, Select, Pagination } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { DocumentTable, DocumentSearchBar, DocumentFormModal } from '@renderer/components/common'
import { useDocumentSearch } from '@renderer/hooks/useDocumentSearch'
import { incomingDocumentApi, classificationApi, unitApi } from '@renderer/lib/api'
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
  const [editingDoc, setEditingDoc] = useState<IncomingDocument | null>(null)
  const [distributions, setDistributions] = useState<IncomingDocumentDistribution[]>([])
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false)

  // Ref'ler — fetchAll'un bağımlılık dizisini sabit tutmak için
  const pageRef = useRef(page)
  const pageSizeRef = useRef(pageSize)
  const recordNoSearchRef = useRef(recordNoSearch)
  const searchQueryRef = useRef(searchQuery)

  // Scroll pozisyonunu korumak için ref'ler
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const pendingScrollTopRef = useRef<number | null>(null)

  // Ref'leri güncel tut
  pageRef.current = page
  pageSizeRef.current = pageSize
  recordNoSearchRef.current = recordNoSearch
  searchQueryRef.current = searchQuery

  const fetchList = useCallback(
    async (params: {
      recordNo?: number
      query?: string
      page: number
      pageSize: number
      silent?: boolean
    }): Promise<void> => {
      try {
        if (!params.silent) setLoading(true)
        const res = await incomingDocumentApi.list(params)
        if (res.success && res.data) {
          setList(res.data.data)
          setTotal(res.data.total)
          setPage(res.data.page)
          setPageSize(res.data.pageSize)
        } else {
          showError(res.message)
        }
      } catch (error) {
        showError('Veri yüklenirken bir hata oluştu')
        console.error(error)
      } finally {
        if (!params.silent) setLoading(false)
      }
    },
    []
  )

  /** Tüm listeyi yeniden çek. preserveState=true ise mevcut sayfayı ve scroll'u koru. */
  const fetchAll = useCallback(
    (preserveState = false) => {
      if (preserveState) {
        // Scroll pozisyonunu kaydet
        if (scrollViewportRef.current) {
          pendingScrollTopRef.current = scrollViewportRef.current.scrollTop
        }
        const rn = recordNoSearchRef.current.trim()
        void fetchList({
          recordNo: rn ? parseInt(rn, 10) : undefined,
          query: searchQueryRef.current.trim() || undefined,
          page: pageRef.current,
          pageSize: pageSizeRef.current,
          silent: true
        })
      } else {
        void fetchList({ page: 1, pageSize: pageSizeRef.current })
      }
    },
    [fetchList]
  )

  const fetchSearch = useCallback(
    (params: { recordNo?: number; query?: string }) => {
      void fetchList({ ...params, page: 1, pageSize: pageSizeRef.current })
    },
    [fetchList]
  )

  const loadDistributions = useCallback(async (docId: number): Promise<void> => {
    const res = await incomingDocumentApi.getDistributions(docId)
    if (res.success) setDistributions(res.data)
    else setDistributions([])
  }, [])

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

  // Veri güncellendikten sonra scroll pozisyonunu geri yükle
  useEffect(() => {
    if (pendingScrollTopRef.current !== null && scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = pendingScrollTopRef.current
      pendingScrollTopRef.current = null
    }
  }, [list])

  const handleRowClick = useCallback(
    (row: IncomingDocument): void => {
      setSelectedDoc(row)
      void loadDistributions(row.id)
    },
    [loadDistributions]
  )

  const handleRowDoubleClick = useCallback(
    (row: IncomingDocument): void => {
      setEditingDoc(row)
      openModal()
    },
    [openModal]
  )

  const handleNewDocument = useCallback(() => {
    setEditingDoc(null)
    openModal()
  }, [openModal])

  const handleFormSuccess = useCallback(() => {
    // Eğer düzenleme modundaysak sayfayı koru, yoksa başa dön
    fetchAll(!!editingDoc)
  }, [fetchAll, editingDoc])

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
          onNewDocumentClick={handleNewDocument}
          onSearchSubmit={({ recordNo, query }) => {
            if (!recordNo && !query) void fetchAll(false)
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
            onRowDoubleClick={handleRowDoubleClick}
            emptyMessage="Henüz kayıt yok."
            selectedRowId={selectedDoc?.id}
            viewportRef={scrollViewportRef}
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
                    const rn = recordNoSearch.trim() ? parseInt(recordNoSearch, 10) : undefined
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
                  const rn = recordNoSearch.trim() ? parseInt(recordNoSearch, 10) : undefined
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
      <Card withBorder shadow="sm" radius="md" padding="sm" style={{ flexShrink: 0 }}>
        <Text fw={700} size="sm" mb="xs" tt="uppercase">
          HAVALE/DAĞITIM
        </Text>
        <DistributionTable distributions={distributions} units={units} />
      </Card>

      <DocumentFormModal
        opened={modalOpened}
        onClose={() => {
          closeModal()
          setEditingDoc(null)
        }}
        onSuccess={handleFormSuccess}
        scope="INCOMING"
        editingDocument={editingDoc}
      />
    </Box>
  )
}
