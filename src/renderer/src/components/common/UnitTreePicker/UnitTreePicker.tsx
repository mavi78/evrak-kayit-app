// ============================================================
// UnitTreePicker - Birlik seçici (tree popup + autocomplete arama)
//
// Özellikler:
// - Multi-select (birden fazla seçim)
// - Tree popup: sürüklenebilir, hiyerarşik
// - Arama: input'a yazınca otomatik açılır
// - Birim modu: Sadece organizasyon birliği altındaki birimler
// ============================================================

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  TextInput,
  ActionIcon,
  Box,
  Text,
  Group,
  ScrollArea,
  UnstyledButton,
  Badge,
  Paper,
  useMantineTheme
} from '@mantine/core'
import {
  IconSearch,
  IconListTree,
  IconChevronRight,
  IconChevronDown,
  IconX,
  IconGripVertical,
  IconCheck
} from '@tabler/icons-react'
import { appSettingsApi } from '@renderer/lib/api'
import type { Unit } from '@shared/types'

// ---- Tree yardımcıları ----

interface TreeNode extends Unit {
  children: TreeNode[]
}

/**
 * Verilen birim listesinden ağaç yapısını oluşturur.
 * Eğer bir düğümün parent'ı listede yoksa, o düğüm "kök" olarak kabul edilir.
 * Bu sayede filtrelenmiş listelerde (örn. Birim modu) ağaç bozulmaz.
 */
function buildTree(units: Unit[]): TreeNode[] {
  const map = new Map<number, TreeNode>()
  const roots: TreeNode[] = []

  // 1. Tüm düğümleri oluştur
  units.forEach((unit) => {
    map.set(unit.id, { ...unit, children: [] })
  })

  // 2. İlişkileri kur
  units.forEach((unit) => {
    const node = map.get(unit.id)!
    // Parent var mı ve bu listede mevcut mu?
    if (unit.parent_id != null && map.has(unit.parent_id)) {
      const parent = map.get(unit.parent_id)
      parent!.children.push(node)
    } else {
      // Parent'ı yoksa veya listede değilse -> Kök düğüm
      roots.push(node)
    }
  })

  // 3. Sırala
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

/** Belirli bir birliğin alt ağacını (kendisi dahil) döndürür */
function getSubtree(units: Unit[], rootId: number): Unit[] {
  const result: Unit[] = []
  const parentMap = new Map<number | null, Unit[]>()

  units.forEach((u) => {
    const key = u.parent_id
    if (!parentMap.has(key)) parentMap.set(key, [])
    parentMap.get(key)!.push(u)
  })

  function collect(id: number): void {
    const children = parentMap.get(id) ?? []
    children.forEach((child) => {
      result.push(child)
      collect(child.id)
    })
  }

  const root = units.find((u) => u.id === rootId)
  if (root) {
    result.push(root)
    collect(rootId)
  }

  return result
}

/** Düz arama */
function searchFlat(units: Unit[], query: string): Unit[] {
  const lw = query.toLowerCase().trim()
  if (!lw) return []
  return units.filter(
    (u) => u.name.toLowerCase().includes(lw) || u.short_name.toLowerCase().includes(lw)
  )
}

// ---- Sürükleme hook'u ----

function useDraggable(): {
  position: { x: number; y: number }
  onMouseDown: (e: React.MouseEvent) => void
  isDragging: boolean
  reset: () => void
} {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const posStartRef = useRef({ x: 0, y: 0 })

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (['input', 'select', 'button', 'textarea', 'svg', 'path', 'input'].includes(tag)) return
      setIsDragging(true)
      dragStartRef.current = { x: e.clientX, y: e.clientY }
      posStartRef.current = { ...position }
      e.preventDefault()
    },
    [position]
  )

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent): void => {
      setPosition({
        x: posStartRef.current.x + (e.clientX - dragStartRef.current.x),
        y: posStartRef.current.y + (e.clientY - dragStartRef.current.y)
      })
    }
    const onUp = (): void => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging])

  const reset = useCallback(() => setPosition({ x: 0, y: 0 }), [])
  return { position, onMouseDown, isDragging, reset }
}

// ---- Tree düğümü ----

function TreeNodeItem({
  node,
  level,
  expanded,
  selectedIds,
  onToggle,
  onSelect,
  units
}: {
  node: TreeNode
  level: number
  expanded: Set<number>
  selectedIds: Set<number>
  onToggle: (id: number) => void
  onSelect: (unit: Unit) => void
  units: Unit[]
}): React.JSX.Element {
  const theme = useMantineTheme()
  const hasChildren = node.children.length > 0
  const isExpanded = expanded.has(node.id)
  const isSelected = selectedIds.has(node.id)

  const parentUnit = node.parent_id ? units.find((u) => u.id === node.parent_id) : null

  return (
    <>
      <UnstyledButton
        onClick={() => onSelect(node)}
        style={{
          display: 'flex',
          alignItems: 'center', // Checkbox ile ortala
          width: '100%',
          padding: '4px 8px',
          paddingLeft: 8 + level * 20,
          borderRadius: 4,
          transition: 'background 150ms ease',
          background: isSelected ? theme.colors.deniz[0] : 'transparent'
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = theme.colors.gray[1]
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'transparent'
          else e.currentTarget.style.background = theme.colors.deniz[0]
        }}
      >
        {/* Expand icon */}
        {hasChildren ? (
          <ActionIcon
            variant="transparent"
            size="xs"
            onClick={(e) => {
              e.stopPropagation()
              onToggle(node.id)
            }}
            style={{ marginRight: 4, flexShrink: 0 }}
          >
            {isExpanded ? (
              <IconChevronDown size={14} color={theme.colors.dark[3]} />
            ) : (
              <IconChevronRight size={14} color={theme.colors.dark[3]} />
            )}
          </ActionIcon>
        ) : (
          <Box style={{ width: 22, flexShrink: 0 }} />
        )}

        {/* Checkbox yerine görsel seçim ikonu veya sadece highlight */}
        {isSelected && (
          <Box style={{ marginRight: 6, display: 'flex' }}>
            <IconCheck size={14} color={theme.colors.deniz[7]} />
          </Box>
        )}

        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text
            size="sm"
            fw={isSelected ? 600 : hasChildren ? 600 : 400}
            c={isSelected ? 'deniz.9' : undefined}
            truncate="end"
          >
            {node.name}
          </Text>
          {parentUnit && (
            <Text size="xs" c="dimmed" truncate="end">
              {parentUnit.short_name || parentUnit.name}
            </Text>
          )}
        </Box>
      </UnstyledButton>

      {/* Children */}
      {hasChildren &&
        isExpanded &&
        node.children.map((child) => (
          <TreeNodeItem
            key={child.id}
            node={child}
            level={level + 1}
            expanded={expanded}
            selectedIds={selectedIds}
            onToggle={onToggle}
            onSelect={onSelect}
            units={units}
          />
        ))}
    </>
  )
}

// ---- Autocomplete öğe ----

function SearchResultItem({
  unit,
  units,
  isSelected,
  onSelect
}: {
  unit: Unit
  units: Unit[]
  isSelected: boolean
  onSelect: (u: Unit) => void
}): React.JSX.Element {
  const theme = useMantineTheme()
  const parentUnit = unit.parent_id ? units.find((u) => u.id === unit.parent_id) : null

  return (
    <UnstyledButton
      onClick={() => onSelect(unit)}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        padding: '6px 12px',
        borderRadius: 4,
        background: isSelected ? theme.colors.deniz[0] : 'transparent',
        transition: 'background 150ms ease'
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = theme.colors.gray[1]
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent'
        else e.currentTarget.style.background = theme.colors.deniz[0]
      }}
    >
      {isSelected && (
        <Box style={{ marginRight: 8 }}>
          <IconCheck size={14} color={theme.colors.deniz[7]} />
        </Box>
      )}
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text
          size="sm"
          fw={isSelected ? 600 : 500}
          c={isSelected ? 'deniz.9' : undefined}
          truncate="end"
        >
          {unit.name}
        </Text>
        {parentUnit && (
          <Text size="xs" c="dimmed" truncate="end">
            {parentUnit.short_name || parentUnit.name}
          </Text>
        )}
      </Box>
    </UnstyledButton>
  )
}

// ---- Main Component ----

export interface UnitTreePickerProps {
  units: Unit[]
  values: number[] // Multi-select
  onChange: (unitIds: number[]) => void
}

export function UnitTreePicker({
  units,
  values,
  onChange
}: UnitTreePickerProps): React.JSX.Element {
  const theme = useMantineTheme()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // State
  const [searchText, setSearchText] = useState('')
  const [showTree, setShowTree] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [birimMode, setBirimMode] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [orgUnitId, setOrgUnitId] = useState<number | null>(null)

  const treeDrag = useDraggable()

  // Selected Set for O(1) lookup
  const selectedSet = useMemo(() => new Set(values), [values])

  useEffect(() => {
    appSettingsApi.getOrganization().then((res) => {
      if (res.success && res.data?.value) {
        setOrgUnitId(Number(res.data.value))
      }
    })
  }, [])

  // Aktif (Tree) birimleri filtrele
  const activeUnits = useMemo(() => units.filter((u) => u.is_active), [units])

  const treeUnits = useMemo(() => {
    if (birimMode && orgUnitId) {
      return getSubtree(activeUnits, orgUnitId)
    }
    return activeUnits
  }, [activeUnits, birimMode, orgUnitId])

  const treeData = useMemo(() => buildTree(treeUnits), [treeUnits])

  // Arama sonuçları
  const searchResults = useMemo(() => {
    if (!searchText.trim()) return []
    // Arama her zaman seçili moddaki (Birim/Tümü) havuzda yapılır
    const sourceUnits = birimMode && orgUnitId ? getSubtree(activeUnits, orgUnitId) : activeUnits
    return searchFlat(sourceUnits, searchText).slice(0, 50)
  }, [searchText, birimMode, orgUnitId, activeUnits])

  // Input değişim
  const handleInputChange = useCallback((val: string) => {
    setSearchText(val)
    if (val.trim()) {
      setShowSearch(true)
      setShowTree(false)
    } else {
      setShowSearch(false)
      // Arama temizlenince seçimi bozmuyoruz (multi-select)
    }
  }, [])

  // Seçim (Toggle logic)
  const handleSelect = useCallback(
    (unit: Unit) => {
      const newSet = new Set(values)
      if (newSet.has(unit.id)) {
        newSet.delete(unit.id)
      } else {
        newSet.add(unit.id)
      }
      onChange(Array.from(newSet))

      // Arama modundaysa inputu temizle
      if (showSearch) {
        setSearchText('')
        setShowSearch(false)
      }
    },
    [values, onChange, showSearch]
  )

  // Tree toggle expand
  const handleToggle = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Tree butonu
  const handleTreeOpen = useCallback(() => {
    setShowTree((prev) => !prev)
    setShowSearch(false)
    treeDrag.reset()
    if (!showTree) {
      // Tree açılırken seçili eleman varsa onların parentlarını expand etsek iyi olur ama zorunlu değil
      // Default olarak kökleri açalım
      const topLevel = treeData.map((n) => n.id)
      setExpanded(new Set(topLevel))
    }
  }, [showTree, treeData, treeDrag])

  const handleClear = useCallback(() => {
    onChange([])
    setSearchText('')
    setShowSearch(false)
    setShowTree(false)
    inputRef.current?.focus()
  }, [onChange])

  const handleModeToggle = useCallback(() => {
    setBirimMode((prev) => !prev)
    setExpanded(new Set())
  }, [])

  // Dış tıklama
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSearch(false)
        // Tree'yi kapatmıyor kullanıcı isteği üzerine ("kapatma iconu olsun" dedi)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <Box ref={containerRef} style={{ position: 'relative' }}>
      <Group gap={4} wrap="nowrap">
        <TextInput
          ref={inputRef}
          value={searchText}
          onChange={(e) => handleInputChange(e.currentTarget.value)}
          placeholder={
            values.length > 0
              ? `${values.length} birlik seçildi (Aramak için yazın...)`
              : 'Birlik arayın...'
          }
          size="sm"
          style={{ flex: 1 }}
          rightSection={
            searchText || values.length > 0 ? (
              <ActionIcon variant="subtle" size="sm" onClick={handleClear}>
                <IconX size={14} />
              </ActionIcon>
            ) : (
              <IconSearch size={14} color={theme.colors.gray[5]} />
            )
          }
        />
        <ActionIcon
          variant={showTree ? 'filled' : 'light'}
          color="deniz"
          size="input-sm"
          onClick={handleTreeOpen}
          title="Birlik ağacı"
        >
          <IconListTree size={18} />
        </ActionIcon>
        <ActionIcon
          variant="light"
          color={birimMode ? 'deniz' : 'grape'}
          size="input-sm"
          onClick={handleModeToggle}
          title={birimMode ? 'Sadece kendi birliğiniz' : 'Tüm birlikler'}
          style={{ minWidth: 52, fontSize: '0.72rem', fontWeight: 700 }}
        >
          {birimMode ? 'Birim' : 'Tümü'}
        </ActionIcon>
      </Group>

      {/* Arama Sonuçları */}
      {showSearch && searchResults.length > 0 && (
        <Paper
          shadow="lg"
          radius="md"
          withBorder
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            marginTop: 4,
            maxHeight: 300,
            overflow: 'auto',
            borderColor: theme.colors.deniz[3]
          }}
        >
          <ScrollArea mah={300} scrollbarSize={4} type="hover">
            <Box p={4}>
              {searchResults.map((u) => (
                <SearchResultItem
                  key={u.id}
                  unit={u}
                  units={units}
                  isSelected={selectedSet.has(u.id)}
                  onSelect={handleSelect}
                />
              ))}
            </Box>
          </ScrollArea>
        </Paper>
      )}

      {/* Tree Popup */}
      {showTree && (
        <Paper
          shadow="xl"
          radius="md"
          withBorder
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 1000,
            marginTop: 4,
            width: 420,
            transform: `translate(${treeDrag.position.x}px, ${treeDrag.position.y}px)`,
            transition: treeDrag.isDragging ? 'none' : 'transform 0.15s ease',
            borderColor: theme.colors.deniz[3]
          }}
        >
          <Box
            onMouseDown={treeDrag.onMouseDown}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              background: `linear-gradient(135deg, ${theme.colors.deniz[4]} 0%, ${theme.colors.deniz[6]} 100%)`,
              borderTopLeftRadius: theme.radius.md,
              borderTopRightRadius: theme.radius.md,
              cursor: treeDrag.isDragging ? 'grabbing' : 'grab',
              userSelect: 'none'
            }}
          >
            <Group gap={6}>
              <IconGripVertical size={14} color="rgba(255,255,255,0.5)" />
              <Text size="xs" fw={700} c="white" tt="uppercase">
                Birlik Seçimi
              </Text>
              <Badge size="xs" variant="filled" color="rgba(255,255,255,0.2)" c="white">
                {birimMode ? 'Birim' : 'Tümü'}
              </Badge>
              {values.length > 0 && (
                <Badge size="xs" variant="white" color="deniz">
                  {values.length} seçili
                </Badge>
              )}
            </Group>
            <ActionIcon
              variant="subtle"
              color="white"
              size="xs"
              onClick={() => setShowTree(false)}
              style={{ opacity: 0.8 }}
            >
              <IconX size={14} />
            </ActionIcon>
          </Box>

          <ScrollArea h={320} scrollbarSize={4} type="hover">
            <Box p={6}>
              {treeData.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  {birimMode ? 'Organizasyon birliği ayarlanmamış' : 'Birlik bulunamadı'}
                </Text>
              ) : (
                treeData.map((node) => (
                  <TreeNodeItem
                    key={node.id}
                    node={node}
                    level={0}
                    expanded={expanded}
                    selectedIds={selectedSet}
                    onToggle={handleToggle}
                    onSelect={handleSelect}
                    units={units}
                  />
                ))
              )}
            </Box>
          </ScrollArea>
        </Paper>
      )}
    </Box>
  )
}
