// ============================================================
// SettingsPage - Ayarlar menüsü (Birlik, Gizlilik, Kanal, Klasör, Kategori)
//
// Sorumlulukları:
// 1. Sekmeli arayüz ile 5 ayar grubu
// 2. Her sekmede liste + Ekle / Düzenle / Sil (CRUD)
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Title,
  Text,
  Stack,
  Card,
  Button,
  Group,
  Table,
  Badge,
  ActionIcon,
  TextInput,
  Modal,
  Loader,
  Center,
  Tabs,
  Select,
  Switch,
  NumberInput
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus, IconEdit, IconTrash, IconRefresh } from '@tabler/icons-react'
import { unitApi, classificationApi, channelApi, folderApi, categoryApi } from '@renderer/lib/api'
import { handleApiResponse, showError } from '@renderer/lib/notifications'
import type {
  Unit,
  CreateUnitRequest,
  UpdateUnitRequest,
  Classification,
  CreateClassificationRequest,
  UpdateClassificationRequest,
  Channel,
  CreateChannelRequest,
  UpdateChannelRequest,
  Folder,
  CreateFolderRequest,
  UpdateFolderRequest,
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest
} from '@shared/types'

// ===================== BİRLİK =====================

function UnitsTab(): React.JSX.Element {
  const [items, setItems] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Unit | null>(null)
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = useCallback(async (): Promise<void> => {
    setLoading(true)
    const res = await unitApi.getAll()
    if (res.success) setItems(res.data)
    else showError(res.message)
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchItems()
    }, 0)
    return () => clearTimeout(t)
  }, [fetchItems])

  const createForm = useForm<CreateUnitRequest>({
    initialValues: { name: '', short_name: '', parent_id: null, is_active: true },
    validate: {
      name: (v) => (!v?.trim() ? 'Birlik adı zorunludur' : null),
      short_name: (v) => (!v?.trim() ? 'Kısa ad zorunludur' : null)
    }
  })

  const editForm = useForm<UpdateUnitRequest & { name: string; short_name: string }>({
    initialValues: { id: 0, name: '', short_name: '', is_active: true }
  })

  const parentOptions = items.map((u) => ({ value: String(u.id), label: u.name }))

  const openEditModal = (row: Unit): void => {
    setSelected(row)
    editForm.setValues({
      id: row.id,
      name: row.name,
      short_name: row.short_name,
      parent_id: row.parent_id ?? undefined,
      is_active: row.is_active
    })
    openEdit()
  }

  const openDeleteModal = (row: Unit): void => {
    setSelected(row)
    openDelete()
  }

  const handleCreate = async (values: CreateUnitRequest): Promise<void> => {
    setSubmitting(true)
    const res = await unitApi.create({
      ...values,
      parent_id: values.parent_id ?? null
    })
    handleApiResponse(res, { showSuccess: true, successMessage: 'Birlik oluşturuldu' })
    if (res.success) {
      closeCreate()
      createForm.reset()
      void fetchItems()
    }
    setSubmitting(false)
  }

  const handleUpdate = async (
    values: UpdateUnitRequest & { name: string; short_name: string }
  ): Promise<void> => {
    if (!values.id) return
    setSubmitting(true)
    const res = await unitApi.update({
      id: values.id,
      name: values.name,
      short_name: values.short_name,
      parent_id: values.parent_id ?? null,
      is_active: values.is_active
    })
    handleApiResponse(res, { showSuccess: true, successMessage: 'Birlik güncellendi' })
    if (res.success) {
      closeEdit()
      setSelected(null)
      void fetchItems()
    }
    setSubmitting(false)
  }

  const handleDelete = async (): Promise<void> => {
    if (!selected) return
    setSubmitting(true)
    const res = await unitApi.delete(selected.id)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Birlik silindi' })
    if (res.success) {
      closeDelete()
      setSelected(null)
      void fetchItems()
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <Center h={200}>
        <Loader size="md" type="dots" />
      </Center>
    )
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Belge dağıtımı için birlik listesi. Üst birlik boş bırakılırsa en üst düzey birlik olur.
        </Text>
        <Group>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            onClick={fetchItems}
          >
            Yenile
          </Button>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
            Ekle
          </Button>
        </Group>
      </Group>
      <Card withBorder>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Birlik adı</Table.Th>
              <Table.Th>Kısa ad</Table.Th>
              <Table.Th>Üst birlik</Table.Th>
              <Table.Th>Durum</Table.Th>
              <Table.Th w={100}>İşlemler</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>{row.name}</Table.Td>
                <Table.Td>{row.short_name}</Table.Td>
                <Table.Td>
                  {row.parent_id != null
                    ? (items.find((u) => u.id === row.parent_id)?.name ?? row.parent_id)
                    : '—'}
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" color={row.is_active ? 'green' : 'gray'} variant="light">
                    {row.is_active ? 'Aktif' : 'Pasif'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon
                      variant="light"
                      size="sm"
                      color="blue"
                      onClick={() => openEditModal(row)}
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      size="sm"
                      color="red"
                      onClick={() => openDeleteModal(row)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {items.length === 0 && (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            Henüz birlik eklenmemiş
          </Text>
        )}
      </Card>

      <Modal opened={createOpened} onClose={closeCreate} title="Yeni birlik" size="sm">
        <form onSubmit={createForm.onSubmit((v) => void handleCreate(v))}>
          <Stack gap="md">
            <TextInput label="Birlik adı" {...createForm.getInputProps('name')} />
            <TextInput label="Kısa ad" {...createForm.getInputProps('short_name')} />
            <Select
              label="Üst birlik"
              placeholder="Üst birlik yok"
              clearable
              data={parentOptions}
              value={
                createForm.values.parent_id != null ? String(createForm.values.parent_id) : null
              }
              onChange={(v) => createForm.setFieldValue('parent_id', v ? Number(v) : null)}
            />
            <Switch
              label="Aktif"
              {...createForm.getInputProps('is_active', { type: 'checkbox' })}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeCreate}>
                İptal
              </Button>
              <Button type="submit" loading={submitting}>
                Kaydet
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={editOpened} onClose={closeEdit} title="Birlik düzenle" size="sm">
        <form onSubmit={editForm.onSubmit((v) => void handleUpdate(v))}>
          <Stack gap="md">
            <TextInput label="Birlik adı" {...editForm.getInputProps('name')} />
            <TextInput label="Kısa ad" {...editForm.getInputProps('short_name')} />
            <Select
              label="Üst birlik"
              placeholder="Üst birlik yok"
              clearable
              data={parentOptions.filter((o) => Number(o.value) !== editForm.values.id)}
              value={editForm.values.parent_id != null ? String(editForm.values.parent_id) : null}
              onChange={(v) => editForm.setFieldValue('parent_id', v ? Number(v) : null)}
            />
            <Switch label="Aktif" {...editForm.getInputProps('is_active', { type: 'checkbox' })} />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeEdit}>
                İptal
              </Button>
              <Button type="submit" loading={submitting}>
                Güncelle
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={deleteOpened} onClose={closeDelete} title="Birlik sil">
        <Text size="sm">
          &quot;{selected?.name}&quot; birliğini silmek istediğinize emin misiniz?
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closeDelete}>
            İptal
          </Button>
          <Button color="red" loading={submitting} onClick={() => void handleDelete()}>
            Sil
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}

// ===================== GİZLİLİK DERECESİ =====================

function ClassificationsTab(): React.JSX.Element {
  const [items, setItems] = useState<Classification[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Classification | null>(null)
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = useCallback(async (): Promise<void> => {
    setLoading(true)
    const res = await classificationApi.getAll()
    if (res.success) setItems(res.data)
    else showError(res.message)
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchItems()
    }, 0)
    return () => clearTimeout(t)
  }, [fetchItems])

  const createForm = useForm<CreateClassificationRequest>({
    initialValues: {
      name: '',
      short_name: '',
      requires_security_number: false,
      sort_order: 0,
      is_default: false,
      is_active: true
    },
    validate: {
      name: (v) => (!v?.trim() ? 'Gizlilik adı zorunludur' : null),
      short_name: (v) => (!v?.trim() ? 'Kısa ad zorunludur' : null)
    }
  })

  const editForm = useForm<
    UpdateClassificationRequest & {
      name: string
      short_name: string
      requires_security_number: boolean
      sort_order: number
      is_default: boolean
      is_active: boolean
    }
  >({
    initialValues: {
      id: 0,
      name: '',
      short_name: '',
      requires_security_number: false,
      sort_order: 0,
      is_default: false,
      is_active: true
    }
  })

  const openEditModal = (row: Classification): void => {
    setSelected(row)
    editForm.setValues({
      id: row.id,
      name: row.name,
      short_name: row.short_name,
      requires_security_number: row.requires_security_number,
      sort_order: row.sort_order,
      is_default: row.is_default,
      is_active: row.is_active
    })
    openEdit()
  }

  const openDeleteModal = (row: Classification): void => {
    setSelected(row)
    openDelete()
  }

  const handleCreate = async (values: CreateClassificationRequest): Promise<void> => {
    setSubmitting(true)
    const res = await classificationApi.create(values)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Gizlilik derecesi oluşturuldu' })
    if (res.success) {
      closeCreate()
      createForm.reset()
      void fetchItems()
    }
    setSubmitting(false)
  }

  const handleUpdate = async (
    values: UpdateClassificationRequest & {
      name: string
      short_name: string
      requires_security_number: boolean
      sort_order: number
      is_default: boolean
      is_active: boolean
    }
  ): Promise<void> => {
    if (!values.id) return
    setSubmitting(true)
    const res = await classificationApi.update(values)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Gizlilik derecesi güncellendi' })
    if (res.success) {
      closeEdit()
      setSelected(null)
      void fetchItems()
    }
    setSubmitting(false)
  }

  const handleDelete = async (): Promise<void> => {
    if (!selected) return
    setSubmitting(true)
    const res = await classificationApi.delete(selected.id)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Gizlilik derecesi silindi' })
    if (res.success) {
      closeDelete()
      setSelected(null)
      void fetchItems()
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <Center h={200}>
        <Loader size="md" type="dots" />
      </Center>
    )
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Belge gizlilik seviyeleri. Sadece bir kayıt varsayılan olarak işaretlenebilir.
        </Text>
        <Group>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            onClick={fetchItems}
          >
            Yenile
          </Button>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
            Ekle
          </Button>
        </Group>
      </Group>
      <Card withBorder>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Ad</Table.Th>
              <Table.Th>Kısa ad</Table.Th>
              <Table.Th>Güvenlik no gerekli</Table.Th>
              <Table.Th>Sıra</Table.Th>
              <Table.Th>Varsayılan</Table.Th>
              <Table.Th>Durum</Table.Th>
              <Table.Th w={100}>İşlemler</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>{row.name}</Table.Td>
                <Table.Td>{row.short_name}</Table.Td>
                <Table.Td>{row.requires_security_number ? 'Evet' : 'Hayır'}</Table.Td>
                <Table.Td>{row.sort_order}</Table.Td>
                <Table.Td>{row.is_default ? 'Evet' : '—'}</Table.Td>
                <Table.Td>
                  <Badge size="sm" color={row.is_active ? 'green' : 'gray'} variant="light">
                    {row.is_active ? 'Aktif' : 'Pasif'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon
                      variant="light"
                      size="sm"
                      color="blue"
                      onClick={() => openEditModal(row)}
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      size="sm"
                      color="red"
                      onClick={() => openDeleteModal(row)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {items.length === 0 && (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            Henüz gizlilik derecesi eklenmemiş
          </Text>
        )}
      </Card>

      <Modal opened={createOpened} onClose={closeCreate} title="Yeni gizlilik derecesi" size="sm">
        <form onSubmit={createForm.onSubmit((v) => void handleCreate(v))}>
          <Stack gap="md">
            <TextInput label="Gizlilik adı" {...createForm.getInputProps('name')} />
            <TextInput label="Kısa ad" {...createForm.getInputProps('short_name')} />
            <Switch
              label="Güvenlik numarası gerekli"
              {...createForm.getInputProps('requires_security_number', { type: 'checkbox' })}
            />
            <NumberInput label="Sıralama" min={0} {...createForm.getInputProps('sort_order')} />
            <Switch
              label="Varsayılan (sadece bir kayıt olabilir)"
              {...createForm.getInputProps('is_default', { type: 'checkbox' })}
            />
            <Switch
              label="Aktif"
              {...createForm.getInputProps('is_active', { type: 'checkbox' })}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeCreate}>
                İptal
              </Button>
              <Button type="submit" loading={submitting}>
                Kaydet
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={editOpened} onClose={closeEdit} title="Gizlilik derecesi düzenle" size="sm">
        <form onSubmit={editForm.onSubmit((v) => void handleUpdate(v))}>
          <Stack gap="md">
            <TextInput label="Gizlilik adı" {...editForm.getInputProps('name')} />
            <TextInput label="Kısa ad" {...editForm.getInputProps('short_name')} />
            <Switch
              label="Güvenlik numarası gerekli"
              {...editForm.getInputProps('requires_security_number', { type: 'checkbox' })}
            />
            <NumberInput label="Sıralama" min={0} {...editForm.getInputProps('sort_order')} />
            <Switch
              label="Varsayılan"
              {...editForm.getInputProps('is_default', { type: 'checkbox' })}
            />
            <Switch label="Aktif" {...editForm.getInputProps('is_active', { type: 'checkbox' })} />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeEdit}>
                İptal
              </Button>
              <Button type="submit" loading={submitting}>
                Güncelle
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={deleteOpened} onClose={closeDelete} title="Gizlilik derecesi sil">
        <Text size="sm">
          &quot;{selected?.name}&quot; gizlilik derecesini silmek istediğinize emin misiniz?
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closeDelete}>
            İptal
          </Button>
          <Button color="red" loading={submitting} onClick={() => void handleDelete()}>
            Sil
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}

// ===================== KANAL =====================

function ChannelsTab(): React.JSX.Element {
  const [items, setItems] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Channel | null>(null)
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = useCallback(async (): Promise<void> => {
    setLoading(true)
    const res = await channelApi.getAll()
    if (res.success) setItems(res.data)
    else showError(res.message)
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchItems()
    }, 0)
    return () => clearTimeout(t)
  }, [fetchItems])

  const createForm = useForm<CreateChannelRequest>({
    initialValues: { name: '', sort_order: 0, is_default: false, is_active: true },
    validate: { name: (v) => (!v?.trim() ? 'Kanal adı zorunludur' : null) }
  })

  const editForm = useForm<
    UpdateChannelRequest & {
      name: string
      sort_order: number
      is_default: boolean
      is_active: boolean
    }
  >({
    initialValues: { id: 0, name: '', sort_order: 0, is_default: false, is_active: true }
  })

  const openEditModal = (row: Channel): void => {
    setSelected(row)
    editForm.setValues({
      id: row.id,
      name: row.name,
      sort_order: row.sort_order,
      is_default: row.is_default,
      is_active: row.is_active
    })
    openEdit()
  }

  const handleCreate = async (values: CreateChannelRequest): Promise<void> => {
    setSubmitting(true)
    const res = await channelApi.create(values)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Kanal oluşturuldu' })
    if (res.success) {
      closeCreate()
      createForm.reset()
      void fetchItems()
    }
    setSubmitting(false)
  }

  const handleUpdate = async (
    values: UpdateChannelRequest & {
      name: string
      sort_order: number
      is_default: boolean
      is_active: boolean
    }
  ): Promise<void> => {
    if (!values.id) return
    setSubmitting(true)
    const res = await channelApi.update(values)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Kanal güncellendi' })
    if (res.success) {
      closeEdit()
      setSelected(null)
      void fetchItems()
    }
    setSubmitting(false)
  }

  const handleDelete = async (): Promise<void> => {
    if (!selected) return
    setSubmitting(true)
    const res = await channelApi.delete(selected.id)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Kanal silindi' })
    if (res.success) {
      closeDelete()
      setSelected(null)
      void fetchItems()
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <Center h={200}>
        <Loader size="md" type="dots" />
      </Center>
    )
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Belgenin geldiği veya gönderildiği kanal. Sadece bir kayıt varsayılan olabilir.
        </Text>
        <Group>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            onClick={fetchItems}
          >
            Yenile
          </Button>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
            Ekle
          </Button>
        </Group>
      </Group>
      <Card withBorder>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Kanal adı</Table.Th>
              <Table.Th>Sıra</Table.Th>
              <Table.Th>Varsayılan</Table.Th>
              <Table.Th>Durum</Table.Th>
              <Table.Th w={100}>İşlemler</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>{row.name}</Table.Td>
                <Table.Td>{row.sort_order}</Table.Td>
                <Table.Td>{row.is_default ? 'Evet' : '—'}</Table.Td>
                <Table.Td>
                  <Badge size="sm" color={row.is_active ? 'green' : 'gray'} variant="light">
                    {row.is_active ? 'Aktif' : 'Pasif'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon
                      variant="light"
                      size="sm"
                      color="blue"
                      onClick={() => openEditModal(row)}
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      size="sm"
                      color="red"
                      onClick={() => {
                        setSelected(row)
                        openDelete()
                      }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {items.length === 0 && (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            Henüz kanal eklenmemiş
          </Text>
        )}
      </Card>

      <Modal opened={createOpened} onClose={closeCreate} title="Yeni kanal" size="sm">
        <form onSubmit={createForm.onSubmit((v) => void handleCreate(v))}>
          <Stack gap="md">
            <TextInput label="Kanal adı" {...createForm.getInputProps('name')} />
            <NumberInput label="Sıralama" min={0} {...createForm.getInputProps('sort_order')} />
            <Switch
              label="Varsayılan"
              {...createForm.getInputProps('is_default', { type: 'checkbox' })}
            />
            <Switch
              label="Aktif"
              {...createForm.getInputProps('is_active', { type: 'checkbox' })}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeCreate}>
                İptal
              </Button>
              <Button type="submit" loading={submitting}>
                Kaydet
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={editOpened} onClose={closeEdit} title="Kanal düzenle" size="sm">
        <form onSubmit={editForm.onSubmit((v) => void handleUpdate(v))}>
          <Stack gap="md">
            <TextInput label="Kanal adı" {...editForm.getInputProps('name')} />
            <NumberInput label="Sıralama" min={0} {...editForm.getInputProps('sort_order')} />
            <Switch
              label="Varsayılan"
              {...editForm.getInputProps('is_default', { type: 'checkbox' })}
            />
            <Switch label="Aktif" {...editForm.getInputProps('is_active', { type: 'checkbox' })} />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeEdit}>
                İptal
              </Button>
              <Button type="submit" loading={submitting}>
                Güncelle
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={deleteOpened} onClose={closeDelete} title="Kanal sil">
        <Text size="sm">
          &quot;{selected?.name}&quot; kanalını silmek istediğinize emin misiniz?
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closeDelete}>
            İptal
          </Button>
          <Button color="red" loading={submitting} onClick={() => void handleDelete()}>
            Sil
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}

// ===================== KLASÖR =====================

function FoldersTab(): React.JSX.Element {
  const [items, setItems] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Folder | null>(null)
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = useCallback(async (): Promise<void> => {
    setLoading(true)
    const res = await folderApi.getAll()
    if (res.success) setItems(res.data)
    else showError(res.message)
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchItems()
    }, 0)
    return () => clearTimeout(t)
  }, [fetchItems])

  const createForm = useForm<CreateFolderRequest>({
    initialValues: { name: '', sort_order: 0, is_default: false, is_active: true },
    validate: { name: (v) => (!v?.trim() ? 'Klasör adı zorunludur' : null) }
  })

  const editForm = useForm<
    UpdateFolderRequest & {
      name: string
      sort_order: number
      is_default: boolean
      is_active: boolean
    }
  >({
    initialValues: { id: 0, name: '', sort_order: 0, is_default: false, is_active: true }
  })

  const openEditModal = (row: Folder): void => {
    setSelected(row)
    editForm.setValues({
      id: row.id,
      name: row.name,
      sort_order: row.sort_order,
      is_default: row.is_default,
      is_active: row.is_active
    })
    openEdit()
  }

  const handleCreate = async (values: CreateFolderRequest): Promise<void> => {
    setSubmitting(true)
    const res = await folderApi.create(values)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Klasör oluşturuldu' })
    if (res.success) {
      closeCreate()
      createForm.reset()
      void fetchItems()
    }
    setSubmitting(false)
  }

  const handleUpdate = async (
    values: UpdateFolderRequest & {
      name: string
      sort_order: number
      is_default: boolean
      is_active: boolean
    }
  ): Promise<void> => {
    if (!values.id) return
    setSubmitting(true)
    const res = await folderApi.update(values)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Klasör güncellendi' })
    if (res.success) {
      closeEdit()
      setSelected(null)
      void fetchItems()
    }
    setSubmitting(false)
  }

  const handleDelete = async (): Promise<void> => {
    if (!selected) return
    setSubmitting(true)
    const res = await folderApi.delete(selected.id)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Klasör silindi' })
    if (res.success) {
      closeDelete()
      setSelected(null)
      void fetchItems()
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <Center h={200}>
        <Loader size="md" type="dots" />
      </Center>
    )
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Kaydedilen belgenin kaldırıldığı dosya. Sadece bir kayıt varsayılan olabilir.
        </Text>
        <Group>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            onClick={fetchItems}
          >
            Yenile
          </Button>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
            Ekle
          </Button>
        </Group>
      </Group>
      <Card withBorder>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Klasör adı</Table.Th>
              <Table.Th>Sıra</Table.Th>
              <Table.Th>Varsayılan</Table.Th>
              <Table.Th>Durum</Table.Th>
              <Table.Th w={100}>İşlemler</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>{row.name}</Table.Td>
                <Table.Td>{row.sort_order}</Table.Td>
                <Table.Td>{row.is_default ? 'Evet' : '—'}</Table.Td>
                <Table.Td>
                  <Badge size="sm" color={row.is_active ? 'green' : 'gray'} variant="light">
                    {row.is_active ? 'Aktif' : 'Pasif'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon
                      variant="light"
                      size="sm"
                      color="blue"
                      onClick={() => openEditModal(row)}
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      size="sm"
                      color="red"
                      onClick={() => {
                        setSelected(row)
                        openDelete()
                      }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {items.length === 0 && (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            Henüz klasör eklenmemiş
          </Text>
        )}
      </Card>

      <Modal opened={createOpened} onClose={closeCreate} title="Yeni klasör" size="sm">
        <form onSubmit={createForm.onSubmit((v) => void handleCreate(v))}>
          <Stack gap="md">
            <TextInput label="Klasör adı" {...createForm.getInputProps('name')} />
            <NumberInput label="Sıralama" min={0} {...createForm.getInputProps('sort_order')} />
            <Switch
              label="Varsayılan"
              {...createForm.getInputProps('is_default', { type: 'checkbox' })}
            />
            <Switch
              label="Aktif"
              {...createForm.getInputProps('is_active', { type: 'checkbox' })}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeCreate}>
                İptal
              </Button>
              <Button type="submit" loading={submitting}>
                Kaydet
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={editOpened} onClose={closeEdit} title="Klasör düzenle" size="sm">
        <form onSubmit={editForm.onSubmit((v) => void handleUpdate(v))}>
          <Stack gap="md">
            <TextInput label="Klasör adı" {...editForm.getInputProps('name')} />
            <NumberInput label="Sıralama" min={0} {...editForm.getInputProps('sort_order')} />
            <Switch
              label="Varsayılan"
              {...editForm.getInputProps('is_default', { type: 'checkbox' })}
            />
            <Switch label="Aktif" {...editForm.getInputProps('is_active', { type: 'checkbox' })} />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeEdit}>
                İptal
              </Button>
              <Button type="submit" loading={submitting}>
                Güncelle
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={deleteOpened} onClose={closeDelete} title="Klasör sil">
        <Text size="sm">
          &quot;{selected?.name}&quot; klasörünü silmek istediğinize emin misiniz?
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closeDelete}>
            İptal
          </Button>
          <Button color="red" loading={submitting} onClick={() => void handleDelete()}>
            Sil
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}

// ===================== KATEGORİ =====================

function CategoriesTab(): React.JSX.Element {
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Category | null>(null)
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = useCallback(async (): Promise<void> => {
    setLoading(true)
    const res = await categoryApi.getAll()
    if (res.success) setItems(res.data)
    else showError(res.message)
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchItems()
    }, 0)
    return () => clearTimeout(t)
  }, [fetchItems])

  const createForm = useForm<CreateCategoryRequest>({
    initialValues: {
      name: '',
      retention_years: 10,
      sort_order: 0,
      is_default: false,
      is_active: true
    },
    validate: { name: (v) => (!v?.trim() ? 'Kategori adı zorunludur' : null) }
  })

  const editForm = useForm<
    UpdateCategoryRequest & {
      name: string
      retention_years: number
      sort_order: number
      is_default: boolean
      is_active: boolean
    }
  >({
    initialValues: {
      id: 0,
      name: '',
      retention_years: 10,
      sort_order: 0,
      is_default: false,
      is_active: true
    }
  })

  const openEditModal = (row: Category): void => {
    setSelected(row)
    editForm.setValues({
      id: row.id,
      name: row.name,
      retention_years: row.retention_years,
      sort_order: row.sort_order,
      is_default: row.is_default,
      is_active: row.is_active
    })
    openEdit()
  }

  const handleCreate = async (values: CreateCategoryRequest): Promise<void> => {
    setSubmitting(true)
    const res = await categoryApi.create(values)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Kategori oluşturuldu' })
    if (res.success) {
      closeCreate()
      createForm.reset()
      void fetchItems()
    }
    setSubmitting(false)
  }

  const handleUpdate = async (
    values: UpdateCategoryRequest & {
      name: string
      retention_years: number
      sort_order: number
      is_default: boolean
      is_active: boolean
    }
  ): Promise<void> => {
    if (!values.id) return
    setSubmitting(true)
    const res = await categoryApi.update(values)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Kategori güncellendi' })
    if (res.success) {
      closeEdit()
      setSelected(null)
      void fetchItems()
    }
    setSubmitting(false)
  }

  const handleDelete = async (): Promise<void> => {
    if (!selected) return
    setSubmitting(true)
    const res = await categoryApi.delete(selected.id)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Kategori silindi' })
    if (res.success) {
      closeDelete()
      setSelected(null)
      void fetchItems()
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <Center h={200}>
        <Loader size="md" type="dots" />
      </Center>
    )
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Belgenin arşivlendiği kategori ve saklanma yılı. Sadece bir kayıt varsayılan olabilir.
        </Text>
        <Group>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            onClick={fetchItems}
          >
            Yenile
          </Button>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
            Ekle
          </Button>
        </Group>
      </Group>
      <Card withBorder>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Kategori adı</Table.Th>
              <Table.Th>Saklanma (yıl)</Table.Th>
              <Table.Th>Sıra</Table.Th>
              <Table.Th>Varsayılan</Table.Th>
              <Table.Th>Durum</Table.Th>
              <Table.Th w={100}>İşlemler</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>{row.name}</Table.Td>
                <Table.Td>{row.retention_years}</Table.Td>
                <Table.Td>{row.sort_order}</Table.Td>
                <Table.Td>{row.is_default ? 'Evet' : '—'}</Table.Td>
                <Table.Td>
                  <Badge size="sm" color={row.is_active ? 'green' : 'gray'} variant="light">
                    {row.is_active ? 'Aktif' : 'Pasif'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon
                      variant="light"
                      size="sm"
                      color="blue"
                      onClick={() => openEditModal(row)}
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      size="sm"
                      color="red"
                      onClick={() => {
                        setSelected(row)
                        openDelete()
                      }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {items.length === 0 && (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            Henüz kategori eklenmemiş
          </Text>
        )}
      </Card>

      <Modal opened={createOpened} onClose={closeCreate} title="Yeni kategori" size="sm">
        <form onSubmit={createForm.onSubmit((v) => void handleCreate(v))}>
          <Stack gap="md">
            <TextInput label="Kategori adı" {...createForm.getInputProps('name')} />
            <NumberInput
              label="Saklanma yılı"
              min={1}
              max={100}
              {...createForm.getInputProps('retention_years')}
            />
            <NumberInput label="Sıralama" min={0} {...createForm.getInputProps('sort_order')} />
            <Switch
              label="Varsayılan"
              {...createForm.getInputProps('is_default', { type: 'checkbox' })}
            />
            <Switch
              label="Aktif"
              {...createForm.getInputProps('is_active', { type: 'checkbox' })}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeCreate}>
                İptal
              </Button>
              <Button type="submit" loading={submitting}>
                Kaydet
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={editOpened} onClose={closeEdit} title="Kategori düzenle" size="sm">
        <form onSubmit={editForm.onSubmit((v) => void handleUpdate(v))}>
          <Stack gap="md">
            <TextInput label="Kategori adı" {...editForm.getInputProps('name')} />
            <NumberInput
              label="Saklanma yılı"
              min={1}
              max={100}
              {...editForm.getInputProps('retention_years')}
            />
            <NumberInput label="Sıralama" min={0} {...editForm.getInputProps('sort_order')} />
            <Switch
              label="Varsayılan"
              {...editForm.getInputProps('is_default', { type: 'checkbox' })}
            />
            <Switch label="Aktif" {...editForm.getInputProps('is_active', { type: 'checkbox' })} />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeEdit}>
                İptal
              </Button>
              <Button type="submit" loading={submitting}>
                Güncelle
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={deleteOpened} onClose={closeDelete} title="Kategori sil">
        <Text size="sm">
          &quot;{selected?.name}&quot; kategorisini silmek istediğinize emin misiniz?
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closeDelete}>
            İptal
          </Button>
          <Button color="red" loading={submitting} onClick={() => void handleDelete()}>
            Sil
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}

// ===================== ANA SAYFA =====================

export default function SettingsPage(): React.JSX.Element {
  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Ayarlar</Title>
        <Text c="dimmed" mt={4} size="sm">
          Birlik, gizlilik derecesi, kanal, klasör ve kategori ayarları
        </Text>
      </div>

      <Tabs defaultValue="units">
        <Tabs.List>
          <Tabs.Tab value="units">Birlik</Tabs.Tab>
          <Tabs.Tab value="classifications">Gizlilik derecesi</Tabs.Tab>
          <Tabs.Tab value="channels">Kanal</Tabs.Tab>
          <Tabs.Tab value="folders">Klasör</Tabs.Tab>
          <Tabs.Tab value="categories">Kategori</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="units" pt="md">
          <UnitsTab />
        </Tabs.Panel>
        <Tabs.Panel value="classifications" pt="md">
          <ClassificationsTab />
        </Tabs.Panel>
        <Tabs.Panel value="channels" pt="md">
          <ChannelsTab />
        </Tabs.Panel>
        <Tabs.Panel value="folders" pt="md">
          <FoldersTab />
        </Tabs.Panel>
        <Tabs.Panel value="categories" pt="md">
          <CategoriesTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
