// ============================================================
// TransitDocumentsPage - Gelen evrak listesi
// Üst: sayfa başlığı + açıklama
// Arama kartı: arama + Yeni Evrak butonu (label yok)
// GELEN EVRAK LİSTESİ kartı: tablo
// Alt: HAVALE/DAĞITIM kartı (seçili evrakın dağıtımları)
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react'
import { Box, Card, Stack, Title, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  DocumentTable,
  DocumentSearchBar,
  DocumentFormModal,
  DocumentPagination,
  DistributionTable,
  DistributionModal,
  DocumentContextMenu,
  useDocumentContextMenu
} from '@renderer/components/common'
import { useDocumentSearch } from '@renderer/hooks/useDocumentSearch'
import { transitDocumentApi, classificationApi, unitApi, channelApi } from '@renderer/lib/api'
import { showError, showSuccess } from '@renderer/lib/notifications'
import { useConfirmModal } from '@renderer/hooks/useConfirmModal'
import { getIncomingDocumentColumns } from './transitDocumentColumns'
import type {
  IncomingDocument,
  DocumentDistribution,
  Classification,
  Unit,
  Channel
} from '@shared/types'

const PAGE_DESCRIPTION =
  'Gelen evrakları listeleyebilir, arayabilir ve yeni evrak kaydı oluşturabilirsiniz. ' +
  'Satıra tıklayarak dağıtım bilgilerini, çift tıklayarak düzenleme formunu, ' +
  'sağ tıklayarak havale/dağıtım işlemlerini başlatabilirsiniz.'

export default function TransitDocumentsPage(): React.JSX.Element {
  const [list, setList] = useState<IncomingDocument[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [idSearch, setIdSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [classifications, setClassifications] = useState<Classification[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedDoc, setSelectedDoc] = useState<IncomingDocument | null>(null)
  const [editingDoc, setEditingDoc] = useState<IncomingDocument | null>(null)
  const [distributions, setDistributions] = useState<DocumentDistribution[]>([])
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false)
  const [distModalOpened, { open: openDistModal, close: closeDistModal }] = useDisclosure(false)
  const { contextMenu, openContextMenu, closeContextMenu } =
    useDocumentContextMenu<IncomingDocument>()
  const { confirm, ConfirmModal } = useConfirmModal()

  // Ref'ler — fetchAll'un bağımlılık dizisini sabit tutmak için
  const pageRef = useRef(page)
  const pageSizeRef = useRef(pageSize)
  const idSearchRef = useRef(idSearch)
  const searchQueryRef = useRef(searchQuery)

  // Güncelleme sonrası scroll'u korumak için ref'ler
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const pendingScrollToRowIdRef = useRef<number | null>(null)
  const editingDocRef = useRef(editingDoc)

  // Ref'leri güncel tut
  pageRef.current = page
  pageSizeRef.current = pageSize
  idSearchRef.current = idSearch
  searchQueryRef.current = searchQuery
  editingDocRef.current = editingDoc

  const fetchList = useCallback(
    async (params: {
      id?: number
      query?: string
      page: number
      pageSize: number
      silent?: boolean
    }): Promise<void> => {
      try {
        if (!params.silent) setLoading(true)
        const res = await transitDocumentApi.list(params)
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
        // Güncellenen satırın ID'sini kaydet (scroll için)
        const editId = editingDocRef.current?.id
        if (editId != null) {
          pendingScrollToRowIdRef.current = editId
        }
        const rn = idSearchRef.current.trim()
        void fetchList({
          id: rn ? parseInt(rn, 10) : undefined,
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
    (params: { id?: number; query?: string }) => {
      void fetchList({ ...params, page: 1, pageSize: pageSizeRef.current })
    },
    [fetchList]
  )

  const loadDistributions = useCallback(async (docId: number): Promise<void> => {
    const res = await transitDocumentApi.getDistributions(docId, 'TRANSIT')
    if (res.success) setDistributions(res.data)
    else setDistributions([])
  }, [])

  /** Dağıtım tablosunda sağ tık ile kanal değiştirme */
  const handleDistChannelChange = useCallback(
    async (distributionId: number, newChannelId: number): Promise<void> => {
      try {
        const res = await transitDocumentApi.updateDistribution({
          id: distributionId,
          channel_id: newChannelId
        })
        if (res.success) {
          showSuccess('Dağıtım şekli güncellendi')
          if (selectedDoc) void loadDistributions(selectedDoc.id)
        } else {
          showError(res.message)
        }
      } catch {
        showError('Dağıtım şekli güncellenirken bir hata oluştu')
      }
    },
    [loadDistributions, selectedDoc]
  )

  /** Dağıtım silme — posta/kurye uyarısı ile */
  const handleDeleteDistribution = useCallback(
    async (dist: DocumentDistribution): Promise<void> => {
      try {
        const isPostal =
          channels.find((c) => c.id === dist.channel_id)?.name.toLowerCase() === 'posta'
        const isCourier =
          channels.find((c) => c.id === dist.channel_id)?.name.toLowerCase() === 'kurye'

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
        } else if (isCourier) {
          const message = dist.is_delivered
            ? `Bu dağıtım ${dist.receipt_no ? `${dist.receipt_no} numaralı ` : ''}senetten çıkarılacaktır.\n\nDevam etmek istiyor musunuz?`
            : 'Bu dağıtım dağıtımdan çıkarılacaktır.\n\nDevam etmek istiyor musunuz?'

          const ok = await confirm({
            title: 'Dağıtım Silme Onayı',
            message,
            confirmLabel: 'Evet, Sil',
            color: 'orange'
          })
          if (!ok) return
        }

        const res = await transitDocumentApi.deleteDistribution(dist.id, isPostal)

        // Backend posta uyarısı döndüyse (frontend isPostal kontrolünden geçmemiş olabilir)
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
          const retryRes = await transitDocumentApi.deleteDistribution(dist.id, true)
          if (retryRes.success) {
            showSuccess('Dağıtım silindi')
            if (selectedDoc) void loadDistributions(selectedDoc.id)
          } else {
            showError(retryRes.message)
          }
          return
        }

        if (res.success) {
          showSuccess('Dağıtım silindi')
          if (selectedDoc) void loadDistributions(selectedDoc.id)
        } else {
          showError(res.message)
        }
      } catch {
        showError('Dağıtım silinirken bir hata oluştu')
      }
    },
    [loadDistributions, selectedDoc, confirm, channels]
  )

  useDocumentSearch({
    idValue: idSearch,
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
    channelApi.getAll().then((res) => {
      if (res.success) setChannels(res.data)
    })
  }, [])

  // Veri güncellendikten sonra düzenlenen satıra scroll yap
  useEffect(() => {
    if (pendingScrollToRowIdRef.current !== null && scrollViewportRef.current) {
      const rowId = pendingScrollToRowIdRef.current
      pendingScrollToRowIdRef.current = null
      // requestAnimationFrame ile DOM güncellemesini bekle
      requestAnimationFrame(() => {
        const rowEl = scrollViewportRef.current?.querySelector(`tr[data-row-id="${rowId}"]`)
        if (rowEl) {
          rowEl.scrollIntoView({ block: 'nearest', behavior: 'instant' })
        }
      })
    }
  }, [list])

  const handleRowClick = useCallback(
    (row: IncomingDocument): void => {
      setSelectedDoc(row)
      void loadDistributions(row.id)
    },
    [loadDistributions]
  )

  /** Context menu 'Havale/Dağıtım' aksiyonu → modal aç */
  const handleDistribution = useCallback(
    (row: IncomingDocument): void => {
      setSelectedDoc(row)
      openDistModal()
    },
    [openDistModal]
  )

  const handleRowDoubleClick = useCallback(
    (row: IncomingDocument): void => {
      setEditingDoc(row)
      openModal()
    },
    [openModal]
  )

  const handleRowContextMenu = useCallback(
    (row: IncomingDocument, event: React.MouseEvent): void => {
      setSelectedDoc(row)
      void loadDistributions(row.id)
      openContextMenu(row, event)
    },
    [loadDistributions, openContextMenu]
  )

  const handleNewDocument = useCallback(() => {
    setEditingDoc(null)
    openModal()
  }, [openModal])

  const handleFormSuccess = useCallback(() => {
    if (editingDoc) {
      // Düzenleme modunda: sayfayı ve scroll'u koru
      fetchAll(true)
    } else {
      // Yeni kayıt: arama alanlarını temizle, seçimi sıfırla ve başa dön
      setIdSearch('')
      setSearchQuery('')
      setSelectedDoc(null)
      setDistributions([])
      fetchAll(false)
    }
  }, [fetchAll, editingDoc])

  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p)
      const rn = idSearch.trim() ? parseInt(idSearch, 10) : undefined
      void fetchList({
        id: rn && !Number.isNaN(rn) ? rn : undefined,
        query: searchQuery.trim() || undefined,
        page: p,
        pageSize
      })
    },
    [fetchList, idSearch, searchQuery, pageSize]
  )

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      setPageSize(newSize)
      const rn = idSearch.trim() ? parseInt(idSearch, 10) : undefined
      void fetchList({
        id: rn && !Number.isNaN(rn) ? rn : undefined,
        query: searchQuery.trim() || undefined,
        page: 1,
        pageSize: newSize
      })
    },
    [fetchList, idSearch, searchQuery]
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
        <Text size="sm" c="dimmed">
          {PAGE_DESCRIPTION}
        </Text>
      </Stack>

      {/* Arama ve Yeni Evrak butonu — ayrı kart */}
      <Card withBorder shadow="sm" radius="md" padding="xs" style={{ flexShrink: 0 }}>
        <DocumentSearchBar
          idValue={idSearch}
          onIdChange={setIdSearch}
          value={searchQuery}
          onChange={setSearchQuery}
          onNewDocumentClick={handleNewDocument}
          onSearchSubmit={({ id, query }) => {
            if (!id && !query) void fetchAll(false)
            else {
              const rn = id ? parseInt(id, 10) : undefined
              void fetchSearch({
                id: rn && !Number.isNaN(rn) ? rn : undefined,
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
            onRowContextMenu={handleRowContextMenu}
            emptyMessage="Henüz kayıt yok."
            selectedRowId={selectedDoc?.id}
            viewportRef={scrollViewportRef}
          />
          <DocumentPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </Box>
      </Card>

      {/* HAVALE/DAĞITIM kartı - sayfa altında sabit */}
      <Card withBorder shadow="sm" radius="md" padding="sm" style={{ flexShrink: 0 }}>
        <Text fw={700} size="sm" mb="xs" tt="uppercase">
          HAVALE/DAĞITIM
        </Text>
        <DistributionTable
          distributions={distributions}
          units={units}
          channels={channels}
          onChannelChange={handleDistChannelChange}
          onDeleteDistribution={handleDeleteDistribution}
        />
      </Card>

      <DocumentFormModal
        opened={modalOpened}
        onClose={() => {
          closeModal()
          setEditingDoc(null)
        }}
        onSuccess={handleFormSuccess}
        scope="TRANSIT"
        editingDocument={editingDoc}
      />

      <DocumentContextMenu<IncomingDocument>
        state={contextMenu}
        onClose={closeContextMenu}
        onEdit={handleRowDoubleClick}
        onDistribution={handleDistribution}
        onDismiss={() => {
          setSelectedDoc(null)
          setDistributions([])
        }}
      />

      <DistributionModal
        opened={distModalOpened}
        onClose={closeDistModal}
        documentId={selectedDoc?.id ?? null}
        documentScope="TRANSIT"
        units={units}
        channels={channels}
        onDistributionsChange={() => {
          if (selectedDoc) void loadDistributions(selectedDoc.id)
        }}
      />
      {ConfirmModal}
    </Box>
  )
}
