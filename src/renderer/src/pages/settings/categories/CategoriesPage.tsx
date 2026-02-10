// ============================================================
// CategoriesPage - Kategori yönetimi (sortable list)
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
  TextInput,
  Modal,
  Loader,
  Center,
  Switch,
  NumberInput,
  Box,
  useMantineTheme
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus, IconEdit, IconTrash, IconRefresh, IconGripVertical } from '@tabler/icons-react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { categoryApi } from '@renderer/lib/api'
import { handleApiResponse, showError } from '@renderer/lib/notifications'
import type {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  UpdateSortOrderRequest
} from '@shared/types'

interface SortableItemProps {
  item: Category
  onEdit: (item: Category) => void
  onDelete: (item: Category) => void
}

function SortableItem({ item, onEdit, onDelete }: SortableItemProps): React.JSX.Element {
  const theme = useMantineTheme()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    border: `1px solid ${theme.colors.gray[3]}`,
    borderRadius: theme.radius.sm,
    backgroundColor: isDragging ? theme.colors.blue[0] : 'white',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm
  }

  return (
    <Box ref={setNodeRef} style={style} p="xs" mb="xs">
      <div
        {...attributes}
        {...listeners}
        style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}
      >
        <IconGripVertical size={16} />
      </div>
      <div style={{ flex: 1 }}>
        <Group gap="xs">
          <Text fw={500}>{item.name}</Text>
          <Text size="xs" c="dimmed">
            Saklanma: {item.retention_years} yıl
          </Text>
          {item.is_default && (
            <Badge size="xs" color="blue">
              Varsayılan
            </Badge>
          )}
        </Group>
      </div>
      <Text size="xs" c="dimmed">
        Sıra: {item.sort_order}
      </Text>
      <Badge size="sm" color={item.is_active ? 'green' : 'gray'} variant="light">
        {item.is_active ? 'Aktif' : 'Pasif'}
      </Badge>
      <Group gap={4}>
        <ActionIcon variant="light" size="sm" color="blue" onClick={() => onEdit(item)}>
          <IconEdit size={14} />
        </ActionIcon>
        <ActionIcon variant="light" size="sm" color="red" onClick={() => onDelete(item)}>
          <IconTrash size={14} />
        </ActionIcon>
      </Group>
    </Box>
  )
}

export default function CategoriesPage(): React.JSX.Element {
  const theme = useMantineTheme()
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Category | null>(null)
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeId, setActiveId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  )

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

  const handleDragStart = (event: DragStartEvent): void => {
    setActiveId(event.active.id as number)
  }

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const newItems = arrayMove(items, oldIndex, newIndex)
    setItems(newItems)

    const updateData: UpdateSortOrderRequest = {
      items: newItems.map((item, index) => ({
        id: item.id,
        sort_order: index
      }))
    }

    setSubmitting(true)
    const res = await categoryApi.updateSortOrder(updateData)
    handleApiResponse(res, { showSuccess: true, successMessage: 'Sıralama güncellendi' })
    if (!res.success) {
      void fetchItems()
    }
    setSubmitting(false)
  }

  const activeItem = activeId ? items.find((item) => item.id === activeId) : null

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
          <Title order={2}>Kategori Yönetimi</Title>
          <Text c="dimmed" mt={4} size="sm">
            Belgenin arşivlendiği kategori ve saklanma yılı. Sürükle-bırak ile sıralamayı
            güncelleyebilirsiniz.
          </Text>
        </div>
        <Group>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={fetchItems}>
            Yenile
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Yeni Kategori
          </Button>
        </Group>
      </Group>

      <Card withBorder>
        {items.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            Henüz kategori eklenmemiş
          </Text>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <Stack gap="xs">
                {items.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    onEdit={openEditModal}
                    onDelete={() => {
                      setSelected(item)
                      openDelete()
                    }}
                  />
                ))}
              </Stack>
            </SortableContext>
            <DragOverlay>
              {activeItem ? (
                <Box
                  p="xs"
                  style={{
                    border: `1px solid ${theme.colors.blue[5]}`,
                    borderRadius: theme.radius.sm,
                    backgroundColor: theme.colors.blue[0],
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    minWidth: 300
                  }}
                >
                  <IconGripVertical size={16} />
                  <Text fw={500}>{activeItem.name}</Text>
                </Box>
              ) : null}
            </DragOverlay>
          </DndContext>
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
