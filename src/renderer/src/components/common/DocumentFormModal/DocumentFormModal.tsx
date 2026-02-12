// ============================================================
// DocumentFormModal - Evrak kayıt modalı (Gelen / Giden / Transit)
// Görseldeki iki kart düzeni: KAYIT BİLGİLER + EVRAK BİLGİLER
// DocumentScope ile hangi sayfadan çağrıldığını bilir.
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import {
  Modal,
  Card,
  Text,
  TextInput,
  NumberInput,
  Select,
  Group,
  Stack,
  Button,
  Loader,
  Center
} from '@mantine/core'
import { IconDeviceFloppy, IconTrash } from '@tabler/icons-react'
import {
  channelApi,
  classificationApi,
  categoryApi,
  folderApi,
  incomingDocumentApi
} from '@renderer/lib/api'
import { showError, showSuccess } from '@renderer/lib/notifications'
import type {
  DocumentScope,
  Channel,
  Classification,
  Category,
  Folder,
  IncomingDocument,
  CreateIncomingDocumentRequest
} from '@shared/types'
import {
  formatDocumentDateForDisplay,
  isValidDocumentDateInput
} from '@shared/utils/documentDateUtils'

export interface DocumentFormModalProps {
  /** Modal açık mı? */
  opened: boolean
  /** Kapatma callback */
  onClose: () => void
  /** Kayıt sonrası tablo yenilensin */
  onSuccess?: () => void
  /** Hangi sayfadan çağrıldığı */
  scope: DocumentScope
  /** Modal başlığı */
  title?: string
  /** Düzenleme modu: Mevcut evrak (yoksa yeni kayıt modu) */
  editingDocument?: IncomingDocument | null
  /** Silme callback (düzenleme modunda) */
  onDelete?: (id: number) => void | Promise<void>
}

/** Scope → başlık eşleme */
const SCOPE_TITLES: Record<DocumentScope, string> = {
  INCOMING: 'Yeni Gelen Evrak',
  OUTGOING: 'Yeni Giden Evrak',
  TRANSIT: 'Yeni Transit Evrak'
}

/** Form başlangıç durumu */
interface FormState {
  recordNo: string
  daySequenceNo: string
  channelId: string
  sourceOffice: string
  referenceNumber: string
  subject: string
  documentDateInput: string
  classificationId: string
  securityControlNo: string
  attachmentCount: number
  pageCount: number
  categoryId: string
  folderId: string
}

const INITIAL_FORM: FormState = {
  recordNo: '',
  daySequenceNo: '',
  channelId: '',
  sourceOffice: '',
  referenceNumber: '',
  subject: '',
  documentDateInput: '',
  classificationId: '',
  securityControlNo: '',
  attachmentCount: 0,
  pageCount: 1,
  categoryId: '',
  folderId: ''
}

/**
 * Evrak kayıt modalı. Gelen, giden ve transit sayfalarından çağrılabilir.
 * İki kartlı düzen: KAYIT BİLGİLER (readonly) + EVRAK BİLGİLER (form).
 */
export function DocumentFormModal({
  opened,
  onClose,
  onSuccess,
  scope,
  title,
  editingDocument,
  onDelete
}: DocumentFormModalProps): React.JSX.Element {
  const isEditMode = editingDocument != null
  const modalTitle = title ?? (isEditMode ? 'Evrak Düzenle' : SCOPE_TITLES[scope])

  // Kayıt tarihi (GG.AA.YYYY formatında) - created_at'ten alınır
  const getRecordDate = (): string => {
    if (isEditMode && editingDocument) {
      return formatDocumentDateForDisplay(editingDocument.created_at)
    }
    // Yeni kayıt modunda bugünün tarihi gösterilir (disabled)
    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = now.getFullYear()
    return `${day}.${month}.${year}`
  }

  const [loadingInfo, setLoadingInfo] = useState(false)

  // Lookup verileri
  const [channels, setChannels] = useState<Channel[]>([])
  const [classifications, setClassifications] = useState<Classification[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [folders, setFolders] = useState<Folder[]>([])

  // Form state
  const [form, setForm] = useState<FormState>({ ...INITIAL_FORM })
  const [saving, setSaving] = useState(false)

  /** Form alanını güncelle */
  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  /** Modal açıldığında lookup verileri çek ve formu doldur */
  useEffect(() => {
    if (!opened) return

    const loadData = async (): Promise<void> => {
      setLoadingInfo(true)

      const [chRes, clRes, catRes, folRes] = await Promise.all([
        channelApi.getAll(),
        classificationApi.getAll(),
        categoryApi.getAll(),
        folderApi.getAll()
      ])

      const newForm = { ...INITIAL_FORM }

      // Düzenleme modunda mevcut verileri yükle
      if (isEditMode && editingDocument) {
        newForm.recordNo = String(editingDocument.record_no)
        newForm.daySequenceNo = String(editingDocument.day_sequence_no)
        newForm.channelId = String(editingDocument.channel_id)
        newForm.sourceOffice = editingDocument.source_office
        newForm.referenceNumber = editingDocument.reference_number
        newForm.subject = editingDocument.subject
        newForm.documentDateInput = formatDocumentDateForDisplay(editingDocument.document_date)
        newForm.classificationId = String(editingDocument.classification_id)
        newForm.securityControlNo = editingDocument.security_control_no
        newForm.attachmentCount = editingDocument.attachment_count
        newForm.pageCount = editingDocument.page_count
        newForm.categoryId = String(editingDocument.category_id)
        newForm.folderId = String(editingDocument.folder_id)
      } else {
        // Yeni kayıt modu: default değerler
        if (chRes.success) {
          const activeChannels = chRes.data.filter((c) => c.is_active)
          setChannels(activeChannels)
          const defaultCh = activeChannels.find((c) => c.is_default)
          if (defaultCh) newForm.channelId = String(defaultCh.id)
        }
        if (clRes.success) {
          const activeCl = clRes.data.filter((c) => c.is_active)
          setClassifications(activeCl)
          const defaultCl = activeCl.find((c) => c.is_default)
          if (defaultCl) newForm.classificationId = String(defaultCl.id)
        }
        if (catRes.success) {
          const activeCat = catRes.data.filter((c) => c.is_active)
          setCategories(activeCat)
          const defaultCat = activeCat.find((c) => c.is_default)
          if (defaultCat) newForm.categoryId = String(defaultCat.id)
        }
        if (folRes.success) {
          const activeFol = folRes.data.filter((f) => f.is_active)
          setFolders(activeFol)
          const defaultFol = activeFol.find((f) => f.is_default)
          if (defaultFol) newForm.folderId = String(defaultFol.id)
        }
        // Varsayılan değerler
        newForm.pageCount = 1
        newForm.attachmentCount = 0
      }

      // Lookup verileri state'e kaydet
      if (chRes.success) {
        setChannels(chRes.data.filter((c) => c.is_active))
      }
      if (clRes.success) {
        setClassifications(clRes.data.filter((c) => c.is_active))
      }
      if (catRes.success) {
        setCategories(catRes.data.filter((c) => c.is_active))
      }
      if (folRes.success) {
        setFolders(folRes.data.filter((f) => f.is_active))
      }

      setForm(newForm)
      setLoadingInfo(false)
    }

    void loadData()
  }, [opened, editingDocument, isEditMode])

  /** Seçili gizlilik derecesi güvenlik kontrol no gerektiriyor mu? */
  const selectedClassification = classifications.find((c) => c.id === Number(form.classificationId))
  const requiresSecurityNo = selectedClassification?.requires_security_number ?? false

  /** Formu kaydet */
  const handleSave = async (): Promise<void> => {
    // Validasyon - Formdaki görsel sıraya göre kontrol edilir
    if (!form.channelId) {
      showError('Gel. Kanal zorunludur')
      return
    }
    if (!form.sourceOffice.trim()) {
      showError('Gel. Makam alanı zorunludur')
      return
    }
    if (!form.referenceNumber.trim()) {
      showError('Sayısı alanı zorunludur')
      return
    }
    if (!form.documentDateInput.trim()) {
      showError('Tarihi alanı zorunludur')
      return
    }
    if (!isValidDocumentDateInput(form.documentDateInput.trim())) {
      showError(
        'Tarihi alanı "dd.MM.yyyy" veya "d\'zoneLetter\' MMM yy" formatında olmalıdır (örn: 12.02.2026 veya 12C Şub 26)'
      )
      return
    }
    if (!form.subject.trim()) {
      showError('Konu zorunludur')
      return
    }
    if (form.attachmentCount < 0) {
      showError('Eki alanı geçerli bir değer olmalıdır')
      return
    }
    if (!form.classificationId) {
      showError('Gizlilik derecesi zorunludur')
      return
    }
    if (requiresSecurityNo && !form.securityControlNo.trim()) {
      showError('Güvenlik Kontrol No zorunludur')
      return
    }
    if (!form.pageCount || form.pageCount < 1) {
      showError('Sayfa Adeti en az 1 olmalıdır')
      return
    }
    if (!form.categoryId) {
      showError('Kategori zorunludur')
      return
    }
    if (!form.folderId) {
      showError('Klasör zorunludur')
      return
    }

    setSaving(true)
    let res

    if (isEditMode && editingDocument) {
      // Güncelleme
      res = await incomingDocumentApi.update({
        id: editingDocument.id,
        channel_id: Number(form.channelId),
        source_office: form.sourceOffice.trim(),
        reference_number: form.referenceNumber.trim(),
        subject: form.subject.trim(),
        document_date_input: form.documentDateInput.trim(),
        classification_id: Number(form.classificationId),
        security_control_no: form.securityControlNo.trim() || undefined,
        attachment_count: form.attachmentCount,
        page_count: form.pageCount,
        category_id: Number(form.categoryId),
        folder_id: Number(form.folderId)
      })
    } else {
      // Yeni kayıt
      const payload: CreateIncomingDocumentRequest = {
        channel_id: Number(form.channelId),
        source_office: form.sourceOffice.trim(),
        reference_number: form.referenceNumber.trim(),
        subject: form.subject.trim(),
        document_date_input: form.documentDateInput.trim(),
        classification_id: Number(form.classificationId),
        security_control_no: form.securityControlNo.trim() || undefined,
        attachment_count: form.attachmentCount,
        page_count: form.pageCount,
        category_id: Number(form.categoryId),
        folder_id: Number(form.folderId)
      }
      res = await incomingDocumentApi.create(payload)
    }

    setSaving(false)

    if (res.success) {
      showSuccess(isEditMode ? 'Evrak güncellendi' : 'Evrak kaydedildi')
      handleAfterSave()
    } else {
      showError(res.message)
    }
  }

  /** Evrakı sil */
  const handleDelete = async (): Promise<void> => {
    if (!isEditMode || !editingDocument || !onDelete) return

    if (window.confirm('Bu evrakı silmek istediğinizden emin misiniz?')) {
      await onDelete(editingDocument.id)
      onSuccess?.()
      onClose()
    }
  }

  /** Kayıt sonrası: Formu sıfırla */
  const handleAfterSave = (): void => {
    // Tabloyu yenile
    onSuccess?.()

    // Default değerlerle formu sıfırla
    const newForm = { ...INITIAL_FORM }
    const defaultCh = channels.find((c) => c.is_default)
    if (defaultCh) newForm.channelId = String(defaultCh.id)
    const defaultCl = classifications.find((c) => c.is_default)
    if (defaultCl) newForm.classificationId = String(defaultCl.id)
    const defaultCat = categories.find((c) => c.is_default)
    if (defaultCat) newForm.categoryId = String(defaultCat.id)
    const defaultFol = folders.find((f) => f.is_default)
    if (defaultFol) newForm.folderId = String(defaultFol.id)
    // Varsayılan değerler
    newForm.pageCount = 1
    newForm.attachmentCount = 0
    setForm(newForm)
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={modalTitle}
      size="xl"
      centered
      closeOnClickOutside={false}
      styles={{
        title: { fontWeight: 700, fontSize: '0.95rem' },
        body: {
          padding: '1.25rem',
          maxHeight: 'calc(100vh - 140px)',
          overflowY: 'auto',
          overflowX: 'hidden'
        },
        content: {
          maxHeight: 'calc(100vh - 40px)',
          maxWidth: '900px'
        }
      }}
    >
      {loadingInfo ? (
        <Center py={60}>
          <Loader size="md" type="dots" />
        </Center>
      ) : (
        <Stack gap="md">
          {/* ── KAYIT BİLGİLER ── */}
          <Card
            withBorder
            radius="md"
            padding="md"
            style={{
              borderColor: 'var(--mantine-color-gray-3)',
              backgroundColor: 'var(--mantine-color-white)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
              maxWidth: '580px'
            }}
          >
            <Text
              fw={700}
              size="xs"
              tt="uppercase"
              c="gray.7"
              mb="md"
              style={{ letterSpacing: '0.5px', fontSize: '0.7rem' }}
            >
              KAYIT BİLGİLER
            </Text>
            <Stack gap="sm">
              {/* Satır 1: Kayıt No (sol) | KAYIT TARİHİ (sağ) */}
              <Group gap="sm" align="flex-end" wrap="nowrap" justify="space-between">
                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <Text
                    size="xs"
                    fw={600}
                    style={{
                      width: '90px',
                      textAlign: 'right',
                      fontSize: '0.7rem',
                      paddingBottom: '4px',
                      flexShrink: 0,
                      display: 'block'
                    }}
                  >
                    Kayıt No:
                  </Text>
                  <TextInput
                    size="xs"
                    value={form.recordNo || '—'}
                    disabled
                    styles={{
                      input: {
                        backgroundColor: 'var(--mantine-color-gray-1)',
                        cursor: 'not-allowed',
                        fontWeight: 500,
                        fontSize: '0.8rem',
                        borderColor: 'var(--mantine-color-gray-3)'
                      }
                    }}
                    style={{ width: '150px', flexShrink: 0 }}
                  />
                </Group>
                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <Text
                    size="xs"
                    fw={700}
                    c="deniz.7"
                    style={{
                      width: '90px',
                      textAlign: 'right',
                      fontSize: '0.7rem',
                      paddingBottom: '4px',
                      flexShrink: 0,
                      display: 'block'
                    }}
                  >
                    KAYIT TARİHİ:
                  </Text>
                  <TextInput
                    size="xs"
                    value={getRecordDate()}
                    disabled
                    styles={{
                      input: {
                        backgroundColor: 'var(--mantine-color-deniz-0)',
                        borderColor: 'var(--mantine-color-deniz-3)',
                        cursor: 'not-allowed',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        textAlign: 'left',
                        color: 'var(--mantine-color-deniz-8)',
                        paddingLeft: 'var(--mantine-spacing-xs)',
                        paddingRight: 'var(--mantine-spacing-xs)'
                      }
                    }}
                    style={{ width: '180px', flexShrink: 0 }}
                  />
                </Group>
              </Group>
              {/* Satır 2: Gün Sıra No (tek başına) */}
              <Group gap="xs" align="flex-end" wrap="nowrap">
                <Text
                  size="xs"
                  fw={600}
                  style={{
                    width: '90px',
                    textAlign: 'right',
                    fontSize: '0.7rem',
                    paddingBottom: '4px',
                    flexShrink: 0,
                    display: 'block'
                  }}
                >
                  Gün Sıra No:
                </Text>
                <TextInput
                  size="xs"
                  value={form.daySequenceNo || '—'}
                  disabled
                  styles={{
                    input: {
                      backgroundColor: 'var(--mantine-color-gray-1)',
                      cursor: 'not-allowed',
                      fontWeight: 500,
                      fontSize: '0.8rem',
                      borderColor: 'var(--mantine-color-gray-3)'
                    }
                  }}
                  style={{ width: '150px', flexShrink: 0 }}
                />
              </Group>
              {/* Satır 3: Gel.Kanal (sabit genişlik) */}
              <Group gap="xs" align="flex-end" wrap="nowrap">
                <Text
                  size="xs"
                  fw={600}
                  style={{
                    width: '90px',
                    textAlign: 'right',
                    fontSize: '0.7rem',
                    paddingBottom: '4px',
                    flexShrink: 0,
                    display: 'block'
                  }}
                >
                  Gel.Kanal: *
                </Text>
                <Select
                  size="xs"
                  placeholder="Seçiniz"
                  data={channels.map((c) => ({ value: String(c.id), label: c.name }))}
                  value={form.channelId || null}
                  onChange={(v) => setField('channelId', v ?? '')}
                  searchable
                  required
                  style={{ width: '150px', flexShrink: 0 }}
                  styles={{
                    input: {
                      transition: 'all 200ms ease',
                      fontSize: '0.8rem',
                      '&:focus': {
                        borderColor: 'var(--mantine-color-deniz-6)',
                        boxShadow: '0 0 0 2px var(--mantine-color-deniz-1)'
                      }
                    }
                  }}
                />
              </Group>
            </Stack>
          </Card>

          {/* ── EVRAK BİLGİLER ── */}
          <Card
            withBorder
            radius="md"
            padding="md"
            style={{
              borderColor: 'var(--mantine-color-gray-3)',
              backgroundColor: 'var(--mantine-color-white)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)'
            }}
          >
            <Text
              fw={700}
              size="xs"
              tt="uppercase"
              c="gray.7"
              mb="md"
              style={{ letterSpacing: '0.5px', fontSize: '0.7rem' }}
            >
              EVRAK BİLGİLER
            </Text>
            <Stack gap="sm">
              {/* Satır 1: Gel.Makam (tam genişlik) */}
              <Group gap="xs" align="flex-end" wrap="nowrap">
                <Text
                  size="xs"
                  fw={600}
                  style={{
                    width: '90px',
                    textAlign: 'right',
                    fontSize: '0.7rem',
                    paddingBottom: '4px',
                    flexShrink: 0,
                    display: 'block'
                  }}
                >
                  Gel.Makam: *
                </Text>
                <TextInput
                  size="xs"
                  placeholder="Makam adı"
                  value={form.sourceOffice}
                  onChange={(e) => setField('sourceOffice', e.currentTarget.value)}
                  required
                  style={{ flex: 1 }}
                  styles={{
                    input: {
                      fontSize: '0.8rem',
                      transition: 'all 200ms ease',
                      '&:focus': {
                        borderColor: 'var(--mantine-color-deniz-6)',
                        boxShadow: '0 0 0 2px var(--mantine-color-deniz-1)'
                      }
                    }
                  }}
                />
              </Group>

              {/* Satır 2: Sayısı + Tarihi */}
              <Group gap="sm" align="flex-end" wrap="nowrap">
                <Group gap="xs" align="flex-end" wrap="nowrap" style={{ flex: 1 }}>
                  <Text
                    size="xs"
                    fw={600}
                    style={{
                      width: '90px',
                      textAlign: 'right',
                      fontSize: '0.7rem',
                      paddingBottom: '4px',
                      flexShrink: 0,
                      display: 'block'
                    }}
                  >
                    Sayısı: *
                  </Text>
                  <TextInput
                    size="xs"
                    placeholder="Evrak sayısı"
                    value={form.referenceNumber}
                    onChange={(e) => setField('referenceNumber', e.currentTarget.value)}
                    required
                    style={{ flex: 1 }}
                    styles={{
                      input: {
                        fontSize: '0.8rem',
                        transition: 'all 200ms ease',
                        '&:focus': {
                          borderColor: 'var(--mantine-color-deniz-6)',
                          boxShadow: '0 0 0 2px var(--mantine-color-deniz-1)'
                        }
                      }
                    }}
                  />
                </Group>
                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <Text
                    size="xs"
                    fw={600}
                    style={{
                      width: '90px',
                      textAlign: 'right',
                      fontSize: '0.7rem',
                      paddingBottom: '4px',
                      flexShrink: 0,
                      display: 'block'
                    }}
                  >
                    Tarihi: *
                  </Text>
                  <TextInput
                    size="xs"
                    placeholder="GG.AA.YYYY"
                    value={form.documentDateInput}
                    onChange={(e) => setField('documentDateInput', e.currentTarget.value)}
                    required
                    maxLength={20}
                    style={{ width: '130px', flexShrink: 0 }}
                    styles={{
                      input: {
                        fontSize: '0.8rem',
                        transition: 'all 200ms ease',
                        '&:focus': {
                          borderColor: 'var(--mantine-color-deniz-6)',
                          boxShadow: '0 0 0 2px var(--mantine-color-deniz-1)'
                        }
                      }
                    }}
                  />
                </Group>
              </Group>

              {/* Satır 3: Konusu (tam genişlik) */}
              <Group gap="xs" align="flex-end" wrap="nowrap">
                <Text
                  size="xs"
                  fw={600}
                  style={{
                    width: '90px',
                    textAlign: 'right',
                    fontSize: '0.7rem',
                    paddingBottom: '4px',
                    flexShrink: 0,
                    display: 'block'
                  }}
                >
                  Konusu: *
                </Text>
                <TextInput
                  size="xs"
                  placeholder="Evrak konusu"
                  value={form.subject}
                  onChange={(e) => setField('subject', e.currentTarget.value)}
                  required
                  style={{ flex: 1 }}
                  styles={{
                    input: {
                      fontSize: '0.8rem',
                      transition: 'all 200ms ease',
                      '&:focus': {
                        borderColor: 'var(--mantine-color-deniz-6)',
                        boxShadow: '0 0 0 2px var(--mantine-color-deniz-1)'
                      }
                    }
                  }}
                />
              </Group>

              {/* Satır 4: Eki + Giz.Derec. + Güv.Kont.Nu */}
              <Group gap="sm" align="flex-end" wrap="nowrap">
                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <Text
                    size="xs"
                    fw={600}
                    style={{
                      width: '90px',
                      textAlign: 'right',
                      fontSize: '0.7rem',
                      paddingBottom: '4px',
                      flexShrink: 0,
                      display: 'block'
                    }}
                  >
                    Eki: *
                  </Text>
                  <NumberInput
                    size="xs"
                    min={0}
                    value={form.attachmentCount}
                    onChange={(v) => setField('attachmentCount', typeof v === 'number' ? v : 0)}
                    required
                    style={{ width: '70px', flexShrink: 0 }}
                    styles={{
                      input: {
                        fontSize: '0.8rem',
                        transition: 'all 200ms ease',
                        '&:focus': {
                          borderColor: 'var(--mantine-color-deniz-6)',
                          boxShadow: '0 0 0 2px var(--mantine-color-deniz-1)'
                        }
                      }
                    }}
                  />
                </Group>
                <Group gap="xs" align="flex-end" wrap="nowrap" style={{ flex: 1 }}>
                  <Text
                    size="xs"
                    fw={600}
                    style={{
                      width: '90px',
                      textAlign: 'right',
                      fontSize: '0.7rem',
                      paddingBottom: '4px',
                      flexShrink: 0,
                      display: 'block'
                    }}
                  >
                    Giz.Derec.: *
                  </Text>
                  <Select
                    size="xs"
                    placeholder="Seçiniz"
                    data={classifications.map((c) => ({
                      value: String(c.id),
                      label: c.short_name
                    }))}
                    value={form.classificationId || null}
                    onChange={(v) => {
                      setField('classificationId', v ?? '')
                      const cl = classifications.find((c) => c.id === Number(v))
                      if (!cl?.requires_security_number) {
                        setField('securityControlNo', '')
                      }
                    }}
                    searchable
                    required
                    style={{ flex: 1, minWidth: 0 }}
                    styles={{
                      input: {
                        fontSize: '0.8rem',
                        transition: 'all 200ms ease',
                        '&:focus': {
                          borderColor: 'var(--mantine-color-deniz-6)',
                          boxShadow: '0 0 0 2px var(--mantine-color-deniz-1)'
                        }
                      }
                    }}
                  />
                </Group>
                <Group gap="xs" align="flex-end" wrap="nowrap" style={{ flex: 1 }}>
                  <Text
                    size="xs"
                    fw={600}
                    style={{
                      width: '90px',
                      textAlign: 'right',
                      fontSize: '0.7rem',
                      paddingBottom: '4px',
                      flexShrink: 0,
                      display: 'block'
                    }}
                  >
                    Güv.Kont.Nu{requiresSecurityNo ? ': *' : ':'}
                  </Text>
                  <TextInput
                    size="xs"
                    placeholder={requiresSecurityNo ? 'Zorunlu' : ''}
                    value={form.securityControlNo}
                    onChange={(e) => setField('securityControlNo', e.currentTarget.value)}
                    disabled={!requiresSecurityNo && form.classificationId !== ''}
                    required={requiresSecurityNo}
                    style={{ flex: 1, minWidth: 0 }}
                    styles={{
                      input: {
                        fontSize: '0.8rem',
                        transition: 'all 200ms ease',
                        '&:focus': {
                          borderColor: 'var(--mantine-color-deniz-6)',
                          boxShadow: '0 0 0 2px var(--mantine-color-deniz-1)'
                        }
                      }
                    }}
                  />
                </Group>
              </Group>

              {/* Satır 5: Sayfa Adeti + Kategorisi + Klasör Adı */}
              <Group gap="sm" align="flex-end" wrap="nowrap">
                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <Text
                    size="xs"
                    fw={600}
                    style={{
                      width: '90px',
                      textAlign: 'right',
                      fontSize: '0.7rem',
                      paddingBottom: '4px',
                      flexShrink: 0,
                      display: 'block'
                    }}
                  >
                    Sayfa Adeti: *
                  </Text>
                  <NumberInput
                    size="xs"
                    min={1}
                    value={form.pageCount}
                    onChange={(v) => setField('pageCount', typeof v === 'number' ? v : 1)}
                    required
                    style={{ width: '70px', flexShrink: 0 }}
                    styles={{
                      input: {
                        fontSize: '0.8rem',
                        transition: 'all 200ms ease',
                        '&:focus': {
                          borderColor: 'var(--mantine-color-deniz-6)',
                          boxShadow: '0 0 0 2px var(--mantine-color-deniz-1)'
                        }
                      }
                    }}
                  />
                </Group>
                <Group gap="xs" align="flex-end" wrap="nowrap" style={{ flex: 1 }}>
                  <Text
                    size="xs"
                    fw={600}
                    style={{
                      width: '90px',
                      textAlign: 'right',
                      fontSize: '0.7rem',
                      paddingBottom: '4px',
                      flexShrink: 0,
                      display: 'block'
                    }}
                  >
                    Kategorisi: *
                  </Text>
                  <Select
                    size="xs"
                    placeholder="Seçiniz"
                    data={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                    value={form.categoryId || null}
                    onChange={(v) => setField('categoryId', v ?? '')}
                    searchable
                    required
                    style={{ flex: 1, minWidth: 0 }}
                    styles={{
                      input: {
                        fontSize: '0.8rem',
                        transition: 'all 200ms ease',
                        '&:focus': {
                          borderColor: 'var(--mantine-color-deniz-6)',
                          boxShadow: '0 0 0 2px var(--mantine-color-deniz-1)'
                        }
                      }
                    }}
                  />
                </Group>
                <Group gap="xs" align="flex-end" wrap="nowrap" style={{ flex: 1 }}>
                  <Text
                    size="xs"
                    fw={600}
                    style={{
                      width: '90px',
                      textAlign: 'right',
                      fontSize: '0.7rem',
                      paddingBottom: '4px',
                      flexShrink: 0,
                      display: 'block'
                    }}
                  >
                    Klasör Adı: *
                  </Text>
                  <Select
                    size="xs"
                    placeholder="Seçiniz"
                    data={folders.map((f) => ({ value: String(f.id), label: f.name }))}
                    value={form.folderId || null}
                    onChange={(v) => setField('folderId', v ?? '')}
                    searchable
                    required
                    style={{ flex: 1, minWidth: 0 }}
                    styles={{
                      input: {
                        fontSize: '0.8rem',
                        transition: 'all 200ms ease',
                        '&:focus': {
                          borderColor: 'var(--mantine-color-deniz-6)',
                          boxShadow: '0 0 0 2px var(--mantine-color-deniz-1)'
                        }
                      }
                    }}
                  />
                </Group>
              </Group>
            </Stack>
          </Card>

          {/* ── BUTONLAR ── */}
          <Group justify="space-between" mt="lg" style={{ flexShrink: 0, paddingTop: '0.5rem' }}>
            {isEditMode && onDelete && (
              <Button
                variant="light"
                color="red"
                size="xs"
                leftSection={<IconTrash size={16} />}
                onClick={handleDelete}
                styles={{
                  root: {
                    transition: 'all 200ms ease',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)'
                    }
                  }
                }}
              >
                Kaldır
              </Button>
            )}
            <Group gap="sm" style={{ marginLeft: 'auto' }}>
              <Button
                variant="default"
                size="xs"
                onClick={onClose}
                styles={{
                  root: {
                    transition: 'all 200ms ease',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'var(--mantine-color-gray-1)',
                      transform: 'translateY(-1px)'
                    }
                  }
                }}
              >
                Kapat
              </Button>
              <Button
                size="xs"
                color="deniz"
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSave}
                loading={saving}
                styles={{
                  root: {
                    transition: 'all 200ms ease',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                    }
                  }
                }}
              >
                {isEditMode ? 'Güncelle' : 'Kaydet'}
              </Button>
            </Group>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
