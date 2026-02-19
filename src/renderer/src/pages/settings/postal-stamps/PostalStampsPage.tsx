// ============================================================
// PostalStampsPage - Posta pulu yönetimi (CRUD)
//
// Sorumlulukları:
// 1. Pul listesi (tablo)
// 2. Ekleme/düzenleme/silme modalleri
// 3. Aktif/pasif durum yönetimi
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Title,
  Text,
  Stack,
  Card,
  Button,
  Group,
  Badge,
  ActionIcon,
  NumberInput,
  Modal,
  Loader,
  Center,
  Switch,
  Table,
  useMantineTheme
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus, IconEdit, IconTrash, IconRefresh } from '@tabler/icons-react'
import { postalStampApi } from '@renderer/lib/api'
import { handleApiResponse, showError } from '@renderer/lib/notifications'
import type { PostalStamp, CreatePostalStampRequest, UpdatePostalStampRequest } from '@shared/types'

/** TL formatla */
const formatTL = (amount: number): string =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount)

export default function PostalStampsPage(): React.JSX.Element {
  const theme = useMantineTheme()
  const [items, setItems] = useState<PostalStamp[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PostalStamp | null>(null)
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = useCallback(async (): Promise<void> => {
    setLoading(true)
    const res = await postalStampApi.getAll()
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

  const createForm = useForm<CreatePostalStampRequest>({
    initialValues: {
      amount: 0,
      is_active: true
    },
    validate: {
      amount: (v) =>
        v === undefined || v === null ? 'Tutar zorunludur' : v < 0 ? 'Tutar negatif olamaz' : null
    }
  })

  const editForm = useForm<UpdatePostalStampRequest & { amount: number; is_active: boolean }>({
    initialValues: {
      id: 0,
      amount: 0,
      is_active: true
    }
  })

  const openEditModal = (row: PostalStamp): void => {
    setSelected(row)
    editForm.setValues({
      id: row.id,
      amount: row.amount,
      is_active: row.is_active
    })
    openEdit()
  }

  const handleCreate = async (values: CreatePostalStampRequest): Promise<void> => {
    setSubmitting(true)
    const res = await postalStampApi.create(values)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Posta pulu oluşturuldu' })
    if (res.success) {
      closeCreate()
      createForm.reset()
      void fetchItems()
    }
    setSubmitting(false)
  }

  const handleUpdate = async (
    values: UpdatePostalStampRequest & { amount: number; is_active: boolean }
  ): Promise<void> => {
    if (!values.id) return
    setSubmitting(true)
    const res = await postalStampApi.update(values)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Posta pulu güncellendi' })
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
    const res = await postalStampApi.delete(selected.id)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Posta pulu silindi' })
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
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Posta Pulu Yönetimi</Title>
          <Text c="dimmed" mt={4} size="sm">
            Posta gönderimlerinde kullanılacak pul fiyatlarını yönetin.
          </Text>
        </div>
        <Group>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={fetchItems}>
            Yenile
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Yeni Pul
          </Button>
        </Group>
      </Group>

      <Card withBorder>
        {items.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            Henüz posta pulu eklenmemiş
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tutar (₺)</Table.Th>
                <Table.Th>Durum</Table.Th>
                <Table.Th style={{ width: 80 }}>İşlem</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Text fw={600} c={theme.colors.deniz[7]}>
                      {formatTL(item.amount)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" color={item.is_active ? 'green' : 'gray'} variant="light">
                      {item.is_active ? 'Aktif' : 'Pasif'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon
                        variant="light"
                        size="sm"
                        color="blue"
                        onClick={() => openEditModal(item)}
                      >
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        size="sm"
                        color="red"
                        onClick={() => {
                          setSelected(item)
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
        )}
      </Card>

      {/* Oluşturma Modalı */}
      <Modal opened={createOpened} onClose={closeCreate} title="Yeni Posta Pulu" size="sm">
        <form onSubmit={createForm.onSubmit((v) => void handleCreate(v))}>
          <Stack gap="md">
            <NumberInput
              label="Tutar (₺)"
              placeholder="Örn: 15.50"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator="."
              decimalSeparator=","
              {...createForm.getInputProps('amount')}
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

      {/* Düzenleme Modalı */}
      <Modal opened={editOpened} onClose={closeEdit} title="Posta Pulu Düzenle" size="sm">
        <form onSubmit={editForm.onSubmit((v) => void handleUpdate(v))}>
          <Stack gap="md">
            <NumberInput
              label="Tutar (₺)"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator="."
              decimalSeparator=","
              {...editForm.getInputProps('amount')}
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

      {/* Silme Onay Modalı */}
      <Modal opened={deleteOpened} onClose={closeDelete} title="Posta Pulu Sil">
        <Text size="sm">
          {formatTL(selected?.amount ?? 0)} tutarındaki pulu silmek istediğinize emin misiniz?
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
