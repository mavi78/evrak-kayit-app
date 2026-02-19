// ============================================================
// useConfirmModal - Onay diyaloğu hook'u
//
// Sorumlulukları:
// 1. window.confirm yerine Mantine Modal ile onay almak
// 2. Promise-tabanlı API — await ile kullanılabilir
// 3. Başlık, mesaj ve buton özelleştirme
//
// Kullanım:
//   const { confirm, ConfirmModal } = useConfirmModal()
//   const ok = await confirm({ title: '...', message: '...' })
//   if (ok) { /* onaylandı */ }
//   return <>{ConfirmModal}</>
// ============================================================

import { useCallback, useRef, useState } from 'react'
import { Modal, Text, Group, Button, Stack } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  color?: string
}

interface ConfirmState extends ConfirmOptions {
  opened: boolean
}

interface UseConfirmModalReturn {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  ConfirmModal: React.JSX.Element
}

export function useConfirmModal(): UseConfirmModalReturn {
  const [state, setState] = useState<ConfirmState>({
    opened: false,
    message: ''
  })

  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setState({
        opened: true,
        title: options.title ?? 'Onay',
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Evet',
        cancelLabel: options.cancelLabel ?? 'İptal',
        color: options.color ?? 'red'
      })
    })
  }, [])

  const handleClose = useCallback((result: boolean) => {
    setState((prev) => ({ ...prev, opened: false }))
    resolveRef.current?.(result)
    resolveRef.current = null
  }, [])

  const ConfirmModal = (
    <Modal
      opened={state.opened}
      onClose={() => handleClose(false)}
      title={state.title}
      centered
      size="sm"
      overlayProps={{ backgroundOpacity: 0.4, blur: 3 }}
    >
      <Stack gap="md">
        <Group align="flex-start" gap="sm" wrap="nowrap">
          <IconAlertTriangle
            size={24}
            color={`var(--mantine-color-${state.color ?? 'red'}-6)`}
            style={{ flexShrink: 0, marginTop: 2 }}
          />
          <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
            {state.message}
          </Text>
        </Group>
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={() => handleClose(false)}>
            {state.cancelLabel}
          </Button>
          <Button color={state.color ?? 'red'} onClick={() => handleClose(true)}>
            {state.confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )

  return { confirm, ConfirmModal }
}
