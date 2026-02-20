# CRUD Sayfa Mimari Şablonu

> Bu dosya sayfa **kod yapısı ve veri akışı** kalıbını gösterir.
> UI/UX bileşen seçimleri ve stil kararları için → [ui-ux-pro-max skill](../../ui-ux-pro-max/SKILL.md) kullanın.

## Tam CRUD Sayfa Şablonu

Aşağıdaki şablon bir CRUD sayfasının mimari yapısını gösterir:
State yönetimi → Veri çekme → Form → Handlers → Filtreleme → Render

```tsx
// src/renderer/src/pages/{modul}/{Modul}Page.tsx
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
  Center
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus, IconEdit, IconTrash, IconSearch, IconRefresh } from '@tabler/icons-react'
import { yourModuleApi } from '@renderer/lib/api'
import { showError, showSuccess, handleApiResponse } from '@renderer/lib/notifications'
import { useAuth } from '@renderer/hooks/useAuth'
import type { YourEntity, CreateYourRequest } from '@shared/types'

export default function YourPage(): React.JSX.Element {
  // === State ===
  const { state: authState } = useAuth()
  const [items, setItems] = useState<YourEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<YourEntity | null>(null)
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false)
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // === Veri Çekme ===
  const fetchItems = useCallback(async (): Promise<void> => {
    setLoading(true)
    const response = await yourModuleApi.getAll()
    if (response.success) {
      setItems(response.data)
    } else {
      showError(response.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // === Form ===
  const createForm = useForm<CreateYourRequest>({
    initialValues: { title: '' },
    validate: {
      title: (v) => (v.trim().length === 0 ? 'Başlık zorunludur' : null)
    }
  })

  // === Handlers ===
  const handleCreate = async (values: CreateYourRequest): Promise<void> => {
    setSubmitting(true)
    const response = await yourModuleApi.create(values)
    handleApiResponse(response, { showSuccess: true, successMessage: 'Kayıt oluşturuldu' })
    if (response.success) {
      createForm.reset()
      closeCreate()
      fetchItems()
    }
    setSubmitting(false)
  }

  const handleDelete = async (): Promise<void> => {
    if (!selectedItem) return
    setSubmitting(true)
    const response = await yourModuleApi.delete(selectedItem.id)
    handleApiResponse(response, { showSuccess: true, successMessage: 'Kayıt silindi' })
    if (response.success) {
      closeDelete()
      setSelectedItem(null)
      fetchItems()
    }
    setSubmitting(false)
  }

  // === Filtreleme ===
  const filteredItems = items.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // === Loading State ===
  if (loading) {
    return (
      <Center h="50vh">
        <Loader size="lg" type="dots" />
      </Center>
    )
  }

  // === Render ===
  return (
    <Stack gap="lg">
      {/* Sayfa Başlığı */}
      <Group justify="space-between">
        <div>
          <Title order={2}>Modül Başlığı</Title>
          <Text c="dimmed" mt={4}>
            Açıklama metni
          </Text>
        </div>
        <Group>
          <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={fetchItems}>
            Yenile
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Yeni Ekle
          </Button>
        </Group>
      </Group>

      {/* Arama */}
      <TextInput
        placeholder="Ara..."
        leftSection={<IconSearch size={16} />}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.currentTarget.value)}
      />

      {/* Tablo */}
      <Card>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ID</Table.Th>
              <Table.Th>Başlık</Table.Th>
              <Table.Th>Durum</Table.Th>
              <Table.Th w={120}>İşlemler</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredItems.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.id}</Table.Td>
                <Table.Td>{item.title}</Table.Td>
                <Table.Td>
                  <Badge color={item.is_active ? 'green' : 'gray'} variant="light">
                    {item.is_active ? 'Aktif' : 'Pasif'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      onClick={() => {
                        setSelectedItem(item)
                        openEdit()
                      }}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() => {
                        setSelectedItem(item)
                        openDelete()
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {filteredItems.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            Kayıt bulunamadı
          </Text>
        )}
      </Card>

      {/* Oluşturma Modal */}
      <Modal opened={createOpened} onClose={closeCreate} title="Yeni Kayıt">
        <form onSubmit={createForm.onSubmit(handleCreate)}>
          <Stack gap="md">
            <TextInput label="Başlık" {...createForm.getInputProps('title')} />
            <Button type="submit" loading={submitting} fullWidth>
              Kaydet
            </Button>
          </Stack>
        </form>
      </Modal>

      {/* Silme Onay Modal */}
      <Modal opened={deleteOpened} onClose={closeDelete} title="Silme Onayı" size="sm">
        <Text>
          <strong>{selectedItem?.title}</strong> kaydını silmek istediğinize emin misiniz?
        </Text>
        <Group mt="md" justify="flex-end">
          <Button variant="default" onClick={closeDelete}>
            İptal
          </Button>
          <Button color="red" onClick={handleDelete} loading={submitting}>
            Sil
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}
```

## Boş State Gösterimi

```tsx
{
  items.length === 0 && (
    <Card>
      <Stack align="center" py="xl" gap="sm">
        <IconInbox size={48} stroke={1} color="var(--mantine-color-dimmed)" />
        <Text c="dimmed">Henüz kayıt bulunmuyor</Text>
        <Button variant="light" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          İlk Kaydı Oluştur
        </Button>
      </Stack>
    </Card>
  )
}
```

## Tarih Gösterimi

```tsx
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

// Tablo hücresinde
;<Table.Td>{format(new Date(item.created_at), 'dd.MM.yyyy HH:mm', { locale: tr })}</Table.Td>
```
