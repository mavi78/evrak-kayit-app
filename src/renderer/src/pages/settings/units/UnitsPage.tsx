// ============================================================
// UnitsPage - Birlik yönetimi (Windows Explorer benzeri tree + drag & drop)
//
// Sorumlulukları:
// 1. Windows Explorer benzeri kompakt tree görünümü
// 2. Drag & drop ile hiyerarşi ve sıralama güncelleme (Seçenek A)
// 3. Arama özelliği (bulunan birlik + alt birlikleri)
// 4. CRUD işlemleri
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  Select,
  Switch,
  Box,
  useMantineTheme,
  UnstyledButton
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconGripVertical,
  IconChevronRight,
  IconChevronDown,
  IconSearch
} from '@tabler/icons-react'
import { unitApi } from '@renderer/lib/api'
import { handleApiResponse, showError } from '@renderer/lib/notifications'
import { useDragDrop, calculateDropTarget, type DropTarget } from '@renderer/hooks/useDragDrop'
import type { Unit, CreateUnitRequest, UpdateUnitRequest } from '@shared/types'

interface TreeNode extends Unit {
  children: TreeNode[]
}

function buildTree(units: Unit[]): TreeNode[] {
  const map = new Map<number, TreeNode>()
  const roots: TreeNode[] = []

  units.forEach((unit) => {
    map.set(unit.id, { ...unit, children: [] })
  })

  units.forEach((unit) => {
    const node = map.get(unit.id)!
    if (unit.parent_id == null) {
      roots.push(node)
    } else {
      const parent = map.get(unit.parent_id)
      if (parent) parent.children.push(node)
    }
  })

  // Her seviyede sort_order'a göre sırala
  function sortChildren(node: TreeNode): void {
    node.children.sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
      return a.name.localeCompare(b.name)
    })
    node.children.forEach(sortChildren)
  }
  roots.forEach(sortChildren)

  return roots
}

function flattenTree(nodes: TreeNode[], expanded: Set<number>): TreeNode[] {
  const result: TreeNode[] = []
  function traverse(node: TreeNode): void {
    result.push(node)
    if (expanded.has(node.id)) {
      node.children.forEach(traverse)
    }
  }
  nodes.forEach(traverse)
  return result
}

function searchTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query.trim()) return nodes
  const lowerQuery = query.toLowerCase()
  const results: TreeNode[] = []

  function matches(node: TreeNode): boolean {
    return (
      node.name.toLowerCase().includes(lowerQuery) ||
      node.short_name.toLowerCase().includes(lowerQuery)
    )
  }

  function collect(node: TreeNode, includeChildren: boolean): void {
    if (matches(node)) {
      results.push(node)
      if (includeChildren) {
        node.children.forEach((child) => collect(child, true))
      }
    } else {
      node.children.forEach((child) => collect(child, includeChildren))
    }
  }

  nodes.forEach((node) => collect(node, false))
  return results
}

interface TreeItemProps {
  node: TreeNode
  level: number
  expanded: Set<number>
  onToggleExpand: (id: number) => void
  onEdit: (unit: Unit) => void
  onDelete: (unit: Unit) => void
  dropTarget: DropTarget
  isDragging: boolean
  onDragStart: (e: React.DragEvent, unitId: number) => void
  onDragOver: (e: React.DragEvent, unitId: number) => void
  onDragEnd: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, unitId: number) => void
}

function TreeItem({
  node,
  level,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  dropTarget,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop
}: TreeItemProps): React.JSX.Element {
  const theme = useMantineTheme()
  const [isHovered, setIsHovered] = useState(false)
  const itemRef = useRef<HTMLDivElement>(null)

  const hasChildren = node.children.length > 0
  const isExpanded = expanded.has(node.id)

  // Drop target görsel geri bildirimi
  let borderStyle: React.CSSProperties = {}
  if (dropTarget === 'child') {
    borderStyle = {
      borderLeft: `3px solid ${theme.colors.blue[6]}`,
      backgroundColor: theme.colors.blue[0]
    }
  } else if (dropTarget === 'sibling-before' || dropTarget === 'sibling-after') {
    borderStyle = {
      borderTop: dropTarget === 'sibling-before' ? `2px solid ${theme.colors.green[6]}` : 'none',
      borderBottom: dropTarget === 'sibling-after' ? `2px solid ${theme.colors.green[6]}` : 'none',
      backgroundColor: theme.colors.green[0]
    }
  }

  return (
    <Box
      ref={itemRef}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(node.id))
        onDragStart(e, node.id)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        onDragOver(e, node.id)
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDrop(e, node.id)
      }}
      style={{
        ...borderStyle,
        display: 'flex',
        alignItems: 'center',
        minHeight: 24,
        paddingLeft: `${level * 20 + 4}px`,
        paddingRight: 4,
        paddingTop: 2,
        paddingBottom: 2,
        fontSize: 12,
        cursor: isDragging ? 'grabbing' : 'grab',
        backgroundColor:
          dropTarget === 'child'
            ? theme.colors.blue[0]
            : dropTarget === 'sibling-before' || dropTarget === 'sibling-after'
              ? theme.colors.green[0]
              : isHovered
                ? theme.colors.gray[1]
                : 'transparent',
        opacity: isDragging ? 0.5 : 1
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Expand/Collapse ikonu */}
      {hasChildren ? (
        <UnstyledButton
          onClick={() => onToggleExpand(node.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            padding: 0,
            marginRight: 4
          }}
        >
          {isExpanded ? (
            <IconChevronDown size={12} stroke={2} />
          ) : (
            <IconChevronRight size={12} stroke={2} />
          )}
        </UnstyledButton>
      ) : (
        <Box style={{ width: 16, height: 16, marginRight: 4 }} />
      )}

      {/* Drag handle */}
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'grab',
          marginRight: 4,
          padding: 2
        }}
      >
        <IconGripVertical size={12} />
      </Box>

      {/* Birlik bilgileri */}
      <Box style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text size="xs" fw={500} style={{ fontSize: 12 }}>
          {node.name}
        </Text>
        <Text size="xs" c="dimmed" style={{ fontSize: 11 }}>
          ({node.short_name})
        </Text>
        <Badge size="xs" color={node.is_active ? 'green' : 'gray'} variant="light">
          {node.is_active ? 'Aktif' : 'Pasif'}
        </Badge>
      </Box>

      {/* Aksiyon butonları */}
      <Group gap={2}>
        <ActionIcon
          variant="subtle"
          size="xs"
          color="blue"
          onClick={() => onEdit(node)}
          style={{ width: 20, height: 20 }}
        >
          <IconEdit size={12} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          size="xs"
          color="red"
          onClick={() => onDelete(node)}
          style={{ width: 20, height: 20 }}
        >
          <IconTrash size={12} />
        </ActionIcon>
      </Group>
    </Box>
  )
}

function TreeView({
  nodes,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  dropTarget,
  draggingId
}: {
  nodes: TreeNode[]
  expanded: Set<number>
  onToggleExpand: (id: number) => void
  onEdit: (unit: Unit) => void
  onDelete: (unit: Unit) => void
  onDragEnd: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent, unitId: number) => void
  onDragStart: (e: React.DragEvent, unitId: number) => void
  onDrop: (e: React.DragEvent, unitId: number) => void
  dropTarget: Map<number, DropTarget>
  draggingId: number | null
}): React.JSX.Element {
  const theme = useMantineTheme()
  const [draggedUnit, setDraggedUnit] = useState<TreeNode | null>(null)

  const flatNodes = useMemo(() => flattenTree(nodes, expanded), [nodes, expanded])

  const handleDragStartLocal = (e: React.DragEvent, unitId: number): void => {
    const unit = flatNodes.find((n) => n.id === unitId)
    setDraggedUnit(unit || null)
    onDragStart(e, unitId)
  }

  const handleDragEndLocal = (e: React.DragEvent): void => {
    setDraggedUnit(null)
    onDragEnd(e)
  }

  return (
    <Box
      style={{
        border: `1px solid ${theme.colors.gray[3]}`,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.gray[0],
        padding: 4
      }}
    >
      {flatNodes.map((node) => {
        const level = getNodeLevel(node.id, nodes)
        return (
          <TreeItem
            key={node.id}
            node={node}
            level={level}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            onEdit={onEdit}
            onDelete={onDelete}
            dropTarget={dropTarget.get(node.id) ?? null}
            isDragging={draggingId === node.id}
            onDragStart={handleDragStartLocal}
            onDragOver={onDragOver}
            onDragEnd={handleDragEndLocal}
            onDrop={onDrop}
          />
        )
      })}
      {/* Drag overlay */}
      {draggedUnit && (
        <Box
          style={{
            position: 'fixed',
            top: -1000,
            left: -1000,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 4,
            paddingRight: 4,
            paddingTop: 2,
            paddingBottom: 2,
            fontSize: 12,
            border: `1px solid ${theme.colors.blue[5]}`,
            borderRadius: theme.radius.sm,
            backgroundColor: theme.colors.blue[0],
            minWidth: 200,
            opacity: 0.8
          }}
        >
          <IconGripVertical size={12} />
          <Text size="xs" fw={500} style={{ fontSize: 12, marginLeft: 4 }}>
            {draggedUnit.name}
          </Text>
        </Box>
      )}
    </Box>
  )
}

function getNodeLevel(id: number, nodes: TreeNode[], level = 0): number {
  for (const node of nodes) {
    if (node.id === id) return level
    const found = getNodeLevel(id, node.children, level + 1)
    if (found !== -1) return found
  }
  return -1
}

export default function UnitsPage(): React.JSX.Element {
  const [items, setItems] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Unit | null>(null)
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false)
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Drag & drop hook'u
  const dragDrop = useDragDrop<Unit>({
    isSameParent: (active, over) => active.parent_id === over.parent_id
  })

  const tree = useMemo(() => buildTree(items), [items])
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree
    return searchTree(tree, searchQuery)
  }, [tree, searchQuery])

  // Arama sonuçlarına göre expanded state'i hesapla
  const computedExpanded = useMemo(() => {
    if (!searchQuery.trim()) return expanded

    const resultSet = new Set(filteredTree.map((r) => r.id))
    const expandedSet = new Set<number>()
    function expandParents(node: TreeNode): void {
      if (resultSet.has(node.id)) {
        expandedSet.add(node.id)
        node.children.forEach(expandParents)
      } else {
        node.children.forEach(expandParents)
        if (node.children.some((c) => expandedSet.has(c.id))) {
          expandedSet.add(node.id)
        }
      }
    }
    tree.forEach(expandParents)
    return expandedSet
  }, [filteredTree, searchQuery, tree, expanded])

  // Arama yapıldığında expanded state'i güncelle
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpanded(computedExpanded)
    }
  }, [computedExpanded, searchQuery])

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
    initialValues: { name: '', short_name: '', parent_id: null, sort_order: 0, is_active: true },
    validate: {
      name: (v) => (!v?.trim() ? 'Birlik adı zorunludur' : null),
      short_name: (v) => (!v?.trim() ? 'Kısa ad zorunludur' : null)
    }
  })

  const editForm = useForm<UpdateUnitRequest & { name: string; short_name: string }>({
    initialValues: { id: 0, name: '', short_name: '', is_active: true }
  })

  const parentOptions = items.map((u) => ({ value: String(u.id), label: u.name }))

  const toggleExpand = useCallback((id: number): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const openEditModal = (row: Unit): void => {
    setSelected(row)
    editForm.setValues({
      id: row.id,
      name: row.name,
      short_name: row.short_name,
      parent_id: row.parent_id ?? undefined,
      sort_order: row.sort_order,
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
      parent_id: values.parent_id ?? null,
      sort_order: values.sort_order ?? 0
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
      sort_order: values.sort_order,
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

  const handleDragOver = (e: React.DragEvent, overId: number): void => {
    e.preventDefault()
    e.stopPropagation()

    const activeId = dragDrop.draggingId
    if (!activeId || activeId === overId) {
      return
    }

    const activeUnit = items.find((u) => u.id === activeId)
    const overUnit = items.find((u) => u.id === overId)

    if (!activeUnit || !overUnit) {
      return
    }

    // Pozisyon hesapla
    const position = dragDrop.calculatePosition(e, overId)
    if (!position) {
      return
    }

    // Same parent kontrolü
    const sameParent = activeUnit.parent_id === overUnit.parent_id

    // Drop target hesapla (sameParent bilgisiyle)
    const target = calculateDropTarget(position, sameParent)

    // Drop target'ı güncelle
    dragDrop.updateDropTarget(overId, target)
  }

  const handleDrop = async (e: React.DragEvent, overId: number): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()

    const activeId = dragDrop.draggingId
    if (!activeId || activeId === overId) {
      dragDrop.handleDragEnd()
      return
    }

    const activeUnit = items.find((u) => u.id === activeId)
    const overUnit = items.find((u) => u.id === overId)

    if (!activeUnit || !overUnit) {
      dragDrop.handleDragEnd()
      return
    }

    // Pozisyon hesapla
    const position = dragDrop.calculatePosition(e, overId)
    if (!position) {
      dragDrop.handleDragEnd()
      return
    }

    const isOnTop = position.isOnTop
    const isAbove = position.isAbove
    const sameParent = activeUnit.parent_id === overUnit.parent_id

    dragDrop.handleDragEnd()

    // Kendi alt biriminin altına taşımayı engelle
    const descendants = getDescendants(activeUnit.id, items)
    if (descendants.includes(overUnit.id)) {
      showError('Bir birlik kendi alt biriminin altına taşınamaz')
      return
    }

    setSubmitting(true)

    try {
      if (isOnTop) {
        // DURUM 1: Tam üzerine getirilince → Alt birliği ol
        const targetChildren = items.filter((u) => u.parent_id === overUnit.id)
        const maxSortOrder =
          targetChildren.length > 0 ? Math.max(...targetChildren.map((c) => c.sort_order)) : -1

        const res = await unitApi.updateHierarchy({
          id: activeUnit.id,
          parent_id: overUnit.id,
          sort_order: maxSortOrder + 1
        })

        if (res.success) {
          setItems((prev) =>
            prev.map((u) =>
              u.id === activeUnit.id
                ? { ...u, parent_id: overUnit.id, sort_order: maxSortOrder + 1 }
                : u
            )
          )
          handleApiResponse(res, {
            showSuccess: true,
            successMessage: 'Birlik hiyerarşisi güncellendi'
          })
        } else {
          handleApiResponse(res, { showSuccess: false })
        }
      } else if (sameParent) {
        // DURUM 2: Aynı seviyede üst/alt satıra → Sadece sıralama değişimi
        const siblings = items.filter((u) => u.parent_id === activeUnit.parent_id)
        const sortedSiblings = [...siblings].sort((a, b) => {
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
          return a.id - b.id
        })

        const activeIndex = sortedSiblings.findIndex((u) => u.id === activeUnit.id)
        const overIndex = sortedSiblings.findIndex((u) => u.id === overUnit.id)

        if (activeIndex === -1 || overIndex === -1) {
          setSubmitting(false)
          return
        }

        // Aktif birliği listeden çıkar
        const newSiblings = [...sortedSiblings]
        newSiblings.splice(activeIndex, 1)

        // Over birliğin yeni index'i (aktif birliği çıkardıktan sonra)
        const newOverIndex = activeIndex < overIndex ? overIndex - 1 : overIndex

        // Pozisyona göre ekle
        if (isAbove) {
          newSiblings.splice(newOverIndex, 0, activeUnit)
        } else {
          newSiblings.splice(newOverIndex + 1, 0, activeUnit)
        }

        // Yeni sort_order değerlerini oluştur
        const newSortOrders: Array<{ id: number; sort_order: number }> = []
        newSiblings.forEach((u, idx) => {
          newSortOrders.push({ id: u.id, sort_order: idx })
        })

        const res = await unitApi.updateSortOrder({ items: newSortOrders })

        if (res.success) {
          setItems((prev) =>
            prev.map((u) => {
              const newOrder = newSortOrders.find((o) => o.id === u.id)
              return newOrder ? { ...u, sort_order: newOrder.sort_order } : u
            })
          )
          handleApiResponse(res, { showSuccess: true, successMessage: 'Sıralama güncellendi' })
        } else {
          handleApiResponse(res, { showSuccess: false })
        }
      } else {
        // DURUM 3: Farklı seviyede üst/alt satıra → Over birliğin parent'ına geç
        const newParentId = overUnit.parent_id

        // Kendi alt biriminin altına taşımayı engelle
        if (newParentId != null && descendants.includes(newParentId)) {
          showError('Bir birlik kendi alt biriminin altına taşınamaz')
          setSubmitting(false)
          return
        }

        // Over birliğin parent'ının tüm kardeşlerini bul (over ve aktif hariç)
        const allSiblings = items.filter(
          (u) => u.parent_id === newParentId && u.id !== activeUnit.id && u.id !== overUnit.id
        )

        // Over birliği de dahil et (sıralama için)
        const allSiblingsWithOver = [...allSiblings, overUnit].sort((a, b) => {
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
          return a.id - b.id
        })

        // Aktif birliği doğru pozisyona yerleştir
        const overIndexInAll = allSiblingsWithOver.findIndex((u) => u.id === overUnit.id)
        let insertIndex: number

        if (isAbove) {
          // Üst satıra: over birliğin önüne
          insertIndex = overIndexInAll
        } else {
          // Alt satıra: over birliğin arkasına
          insertIndex = overIndexInAll + 1
        }

        // Yeni sıralı liste oluştur
        const newSiblingsOrdered = [...allSiblingsWithOver]
        newSiblingsOrdered.splice(insertIndex, 0, activeUnit)

        // Yeni sort_order değerlerini hesapla
        const updateSortOrders: Array<{ id: number; sort_order: number }> = []
        newSiblingsOrdered.forEach((u, idx) => {
          updateSortOrders.push({ id: u.id, sort_order: idx })
        })

        // Önce parent_id'yi güncelle
        const resHierarchy = await unitApi.updateHierarchy({
          id: activeUnit.id,
          parent_id: newParentId,
          sort_order: updateSortOrders.find((o) => o.id === activeUnit.id)!.sort_order
        })

        if (!resHierarchy.success) {
          handleApiResponse(resHierarchy, { showSuccess: false })
          setSubmitting(false)
          return
        }

        // Sonra tüm sort_order'ları güncelle
        const resSort = await unitApi.updateSortOrder({ items: updateSortOrders })

        if (resSort.success) {
          setItems((prev) =>
            prev.map((u) => {
              const update = updateSortOrders.find((o) => o.id === u.id)
              if (update) {
                return {
                  ...u,
                  sort_order: update.sort_order,
                  ...(u.id === activeUnit.id ? { parent_id: newParentId } : {})
                }
              }
              return u
            })
          )
          handleApiResponse(resSort, {
            showSuccess: true,
            successMessage: 'Birlik hiyerarşisi ve sıralama güncellendi'
          })
        } else {
          handleApiResponse(resSort, { showSuccess: false })
        }
      }
    } catch (error) {
      console.error('Drop işlemi hatası:', error)
      showError('Bir hata oluştu')
    } finally {
      setSubmitting(false)
    }
  }

  function getDescendants(id: number, units: Unit[]): number[] {
    const descendants: number[] = []
    const queue = [id]
    while (queue.length > 0) {
      const currentId = queue.shift()!
      const children = units.filter((u) => u.parent_id === currentId)
      for (const child of children) {
        descendants.push(child.id)
        queue.push(child.id)
      }
    }
    return descendants
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
          <Title order={2}>Birlik Yönetimi</Title>
          <Text c="dimmed" mt={4} size="sm">
            Belge dağıtımı için birlik hiyerarşisi. Windows Explorer benzeri görünüm.
          </Text>
        </div>
        <Group>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={fetchItems}>
            Yenile
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Yeni Birlik
          </Button>
        </Group>
      </Group>

      {/* Arama kutusu */}
      <TextInput
        placeholder="Birlik ara..."
        leftSection={<IconSearch size={16} />}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.currentTarget.value)}
        style={{ maxWidth: 400 }}
      />

      <Card withBorder>
        {filteredTree.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            {searchQuery.trim() ? 'Arama sonucu bulunamadı' : 'Henüz birlik eklenmemiş'}
          </Text>
        ) : (
          <TreeView
            nodes={filteredTree}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            onEdit={openEditModal}
            onDelete={openDeleteModal}
            onDragEnd={dragDrop.handleDragEnd}
            onDragOver={handleDragOver}
            onDragStart={dragDrop.handleDragStart}
            onDrop={handleDrop}
            dropTarget={dragDrop.dropTarget}
            draggingId={dragDrop.draggingId}
          />
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
