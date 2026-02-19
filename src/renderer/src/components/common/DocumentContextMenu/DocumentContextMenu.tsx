// ============================================================
// DocumentContextMenu - Evrak tabloları için sağ tık bağlam menüsü
// Tüm evrak sayfalarında (gelen, giden, transit) yeniden kullanılır.
// ============================================================

import { useRef } from 'react'
import { Box, Menu } from '@mantine/core'
import { IconEdit, IconArrowsLeftRight } from '@tabler/icons-react'
import type { ContextMenuState } from './useDocumentContextMenu'

export interface DocumentContextMenuProps<T> {
  /** Menü durumu — null ise kapalı */
  state: ContextMenuState<T> | null
  /** Menü kapandığında çağrılır (her kapanışta) */
  onClose: () => void
  /** "Düzenle" tıklanınca çağrılır */
  onEdit: (row: T) => void
  /** "Havale/Dağıtım Ekle/Çıkar" tıklanınca çağrılır */
  onDistribution: (row: T) => void
  /** Menü aksiyonsuz kapanınca (dışarı tık, Esc) çağrılır */
  onDismiss?: () => void
}

/**
 * Evrak tabloları için sağ tık bağlam menüsü.
 * Kontrollü bileşendir — state ve callback'ler dışarıdan yönetilir.
 */
export function DocumentContextMenu<T>({
  state,
  onClose,
  onEdit,
  onDistribution,
  onDismiss
}: DocumentContextMenuProps<T>): React.JSX.Element {
  const actionTakenRef = useRef(false)

  return (
    <Menu
      opened={state !== null}
      onChange={(opened) => {
        if (!opened) {
          if (!actionTakenRef.current) {
            onDismiss?.()
          }
          actionTakenRef.current = false
          onClose()
        }
      }}
      position="bottom-start"
      withinPortal
      shadow="xl"
      radius="md"
    >
      <Menu.Target>
        <Box
          style={{
            position: 'fixed',
            left: state?.x ?? 0,
            top: state?.y ?? 0,
            width: 0,
            height: 0,
            pointerEvents: 'none'
          }}
        />
      </Menu.Target>
      <Menu.Dropdown
        style={{
          border: '1px solid var(--mantine-color-deniz-3)',
          minWidth: 220
        }}
      >
        <Menu.Label fw={700} fz="xs" c="deniz.7">
          EVRAK İŞLEMLERİ
        </Menu.Label>
        <Menu.Item
          leftSection={<IconEdit size={18} color="var(--mantine-color-deniz-6)" />}
          fz="sm"
          py={8}
          onClick={() => {
            actionTakenRef.current = true
            if (state) onEdit(state.row)
            onClose()
          }}
        >
          Düzenle
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconArrowsLeftRight size={18} color="var(--mantine-color-teal-6)" />}
          fz="sm"
          py={8}
          onClick={() => {
            actionTakenRef.current = true
            if (state) onDistribution(state.row)
            onClose()
          }}
        >
          Havale/Dağıtım Ekle/Çıkar
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
