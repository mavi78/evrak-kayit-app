// ============================================================
// DocumentSearchBar - Evrak arama (K.No (id) + genel) ve Yeni Evrak butonu
// K.No ayrı textbox; genel arama makam, sayı, konu, tarih vb.
// ============================================================

import { TextInput, Button, Group, Box } from '@mantine/core'
import { IconSearch, IconPlus } from '@tabler/icons-react'

export interface DocumentSearchBarProps {
  /** K.No (id) arama değeri */
  idValue: string
  /** K.No değişince */
  onIdChange: (value: string) => void
  /** Genel arama metni */
  value: string
  /** Genel arama değişince */
  onChange: (value: string) => void
  /** Yeni evrak butonuna tıklanınca */
  onNewDocumentClick: () => void
  /** Enter ile arama tetiklenince */
  onSearchSubmit?: (params: { id: string; query: string }) => void
  /** Yeni evrak buton etiketi */
  newButtonLabel?: string
  /** Genel arama placeholder */
  searchPlaceholder?: string
}

/**
 * Evrak sayfaları için K.No + genel arama + Yeni Kayıt butonu.
 */
export function DocumentSearchBar({
  idValue,
  onIdChange,
  value,
  onChange,
  onNewDocumentClick,
  onSearchSubmit,
  newButtonLabel = 'Yeni Evrak',
  searchPlaceholder = 'Makam, sayı, konu, tarih ile ara (min. 3 karakter veya Enter)'
}: DocumentSearchBarProps): React.JSX.Element {
  const triggerSearch = (): void => {
    if (onSearchSubmit) {
      onSearchSubmit({ id: idValue.trim(), query: value.trim() })
    }
  }

  const handleGenelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      triggerSearch()
    }
  }

  const handleIdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      triggerSearch()
    }
  }

  return (
    <Group justify="space-between" align="center" gap="xs" wrap="wrap" style={{ width: '100%' }}>
      <Group gap="xs" style={{ flex: 1, minWidth: 140 }}>
        <TextInput
          size="xs"
          placeholder="K.No"
          value={idValue}
          onChange={(e) => onIdChange(e.currentTarget.value.replace(/\D/g, ''))}
          onKeyDown={handleIdKeyDown}
          aria-label="Kayıt numarası ile ara"
          w={70}
          style={{ flexShrink: 0 }}
        />
        <TextInput
          size="xs"
          placeholder={searchPlaceholder}
          leftSection={<IconSearch size={14} aria-hidden />}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          onKeyDown={handleGenelKeyDown}
          aria-label="Evrak ara"
          style={{ flex: 1, minWidth: 120 }}
        />
      </Group>
      <Box style={{ flexShrink: 0 }}>
        <Button
          size="xs"
          variant="filled"
          color="deniz"
          leftSection={<IconPlus size={16} stroke={2} aria-hidden />}
          onClick={onNewDocumentClick}
          aria-label={`${newButtonLabel} ekle`}
          radius="sm"
          fw={600}
          style={{
            letterSpacing: '0.02em',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}
        >
          {newButtonLabel}
        </Button>
      </Box>
    </Group>
  )
}
