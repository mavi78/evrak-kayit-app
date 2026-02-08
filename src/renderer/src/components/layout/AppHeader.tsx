// ============================================================
// AppHeader - Üst menü (title bar gibi davranır)
// Frameless pencerede sürüklenebilir alan ve pencere kontrolleri (min/max/close).
// ============================================================

import { useEffect, useState } from 'react'
import { Group, Text, Button, Badge, Box, ActionIcon, Tooltip } from '@mantine/core'
import {
  IconLogout,
  IconUser,
  IconMinus,
  IconSquare,
  IconArrowsMinimize,
  IconX
} from '@tabler/icons-react'
import { useAuth } from '@renderer/hooks/useAuth'

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Süper Yönetici',
  admin: 'Yönetici',
  user: 'Kullanıcı'
}

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'red',
  admin: 'blue',
  user: 'gray'
}

/** Pencere kontrolü: min / max-restore / close — ikon pencere durumuna göre değişir */
function WindowControls(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    void window.api
      .invoke<{ isMaximized: boolean }>('app:window-get-state')
      .then((s) => setIsMaximized(s.isMaximized))
    const onState = (arg: { isMaximized?: boolean }): void => {
      if (typeof arg?.isMaximized === 'boolean') setIsMaximized(arg.isMaximized)
    }
    window.api.on('app:window-state-changed', onState)
    return () => {
      window.api.off('app:window-state-changed', onState)
    }
  }, [])

  const handleMinimize = (): void => {
    window.api.invoke('app:window-minimize')
  }
  const handleMaximize = (): void => {
    window.api.invoke('app:window-maximize')
  }
  const handleClose = (): void => {
    window.api.invoke('app:window-close')
  }

  return (
    <Group gap={0} style={{ WebkitAppRegion: 'no-drag', color: 'var(--mantine-color-white)' }}>
      <Tooltip label="Küçült" position="bottom">
        <ActionIcon
          variant="subtle"
          size="md"
          radius={0}
          onClick={handleMinimize}
          aria-label="Pencereyi küçült"
          style={{ color: 'var(--mantine-color-white)' }}
        >
          <IconMinus size={14} stroke={2} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={isMaximized ? 'Küçült' : 'Büyüt'} position="bottom">
        <ActionIcon
          variant="subtle"
          size="md"
          radius={0}
          onClick={handleMaximize}
          aria-label={isMaximized ? 'Pencereyi küçült' : 'Pencereyi büyüt'}
          style={{ color: 'var(--mantine-color-white)' }}
        >
          {isMaximized ? (
            <IconArrowsMinimize size={12} stroke={2} />
          ) : (
            <IconSquare size={12} stroke={2} />
          )}
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Kapat" position="bottom">
        <ActionIcon
          variant="subtle"
          size="md"
          radius={0}
          onClick={handleClose}
          aria-label="Uygulamayı kapat"
          style={{ color: 'var(--mantine-color-white)' }}
        >
          <IconX size={14} stroke={2} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}

export function AppHeader(): React.JSX.Element {
  const { state, logout } = useAuth()

  return (
    <Box
      px="md"
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--mantine-color-deniz-7)',
        color: 'var(--mantine-color-white)'
      }}
    >
      {/* Sol: Başlık — sürüklenebilir alan (title bar) */}
      <Box
        style={{
          flex: 1,
          minWidth: 0,
          WebkitAppRegion: 'drag',
          cursor: 'default'
        }}
      >
        <Text fw={700} size="lg" c="white">
          TSK Evrak Kayıt Sistemi
        </Text>
      </Box>

      {/* Sağ: Pencere kontrolleri + kullanıcı bilgisi (tıklanabilir alan) */}
      <Group gap="sm" style={{ WebkitAppRegion: 'no-drag', color: 'var(--mantine-color-white)' }}>
        {state.user && (
          <>
            <Group gap="xs" c="white">
              <IconUser size={18} stroke={1.5} />
              <Text size="sm" fw={500} c="white">
                {state.user.full_name}
              </Text>
            </Group>
            <Badge color={ROLE_COLORS[state.user.role]} variant="light" size="sm">
              {ROLE_LABELS[state.user.role]}
            </Badge>
            <Tooltip label="Oturumu kapat" position="bottom">
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                leftSection={<IconLogout size={16} />}
                onClick={logout}
                c="white"
                aria-label="Çıkış yap"
              >
                Çıkış
              </Button>
            </Tooltip>
          </>
        )}
        <WindowControls />
      </Group>
    </Box>
  )
}
