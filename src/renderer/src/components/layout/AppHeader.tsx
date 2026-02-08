// ============================================================
// AppHeader - Üst menü (title bar gibi davranır)
// Frameless pencerede sürüklenebilir alan ve pencere kontrolleri (min/max/close).
// Kullanıcı bilgisi, şifre değiştir modalı ve çıkış butonu.
// ============================================================

import { useEffect, useState } from 'react'
import {
  Group,
  Text,
  Button,
  Box,
  ActionIcon,
  Tooltip,
  Modal,
  Stack,
  PasswordInput
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import {
  IconLogout,
  IconUser,
  IconMinus,
  IconSquare,
  IconArrowsMinimize,
  IconX,
  IconKey
} from '@tabler/icons-react'
import { useAuth } from '@renderer/hooks/useAuth'
import { authApi } from '@renderer/lib/api'
import { handleApiResponse } from '@renderer/lib/notifications'
import { validatePassword } from '@shared/utils'

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

interface ChangePasswordFormValues {
  old_password: string
  new_password: string
  new_password_confirm: string
}

export function AppHeader(): React.JSX.Element {
  const { state, logout } = useAuth()
  const [changePwdOpened, { open: openChangePwd, close: closeChangePwd }] = useDisclosure(false)
  const [submitting, setSubmitting] = useState(false)

  const changePwdForm = useForm<ChangePasswordFormValues>({
    initialValues: {
      old_password: '',
      new_password: '',
      new_password_confirm: ''
    },
    validate: {
      old_password: (v) => (!v?.trim() ? 'Mevcut şifre zorunludur' : null),
      new_password: (v, values) => {
        if (v?.trim() && v === values.old_password) {
          return 'Yeni şifre mevcut şifreden farklı olmalıdır'
        }
        return validatePassword(v ?? '') ?? null
      },
      new_password_confirm: (v, values) =>
        v !== values.new_password ? 'Yeni şifre ile eşleşmiyor' : null
    }
  })

  const handleChangePassword = async (values: ChangePasswordFormValues): Promise<void> => {
    if (!state.user) return
    setSubmitting(true)
    const response = await authApi.changePassword({
      user_id: state.user.id,
      new_password: values.new_password,
      changed_by: state.user.id,
      old_password: values.old_password
    })
    handleApiResponse(response, { showSuccess: true, successMessage: 'Şifre başarıyla değiştirildi' })
    if (response.success) {
      changePwdForm.reset()
      closeChangePwd()
    }
    setSubmitting(false)
  }

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
            <Group gap="sm" c="white" align="center">
              <IconUser size={18} stroke={1.5} style={{ flexShrink: 0 }} />
              <Box>
                <Text size="sm" fw={500} c="white" lh={1.2}>
                  {state.user.full_name}
                </Text>
                {state.user.rutbe ? (
                  <Text
                    size="xs"
                    c="white"
                    opacity={0.9}
                    lh={1.3}
                    fs="italic"
                    style={{ fontSize: '0.7rem' }}
                  >
                    {state.user.rutbe}
                  </Text>
                ) : null}
              </Box>
            </Group>
            <Tooltip label="Şifre değiştir" position="bottom">
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                leftSection={<IconKey size={16} stroke={1.5} />}
                onClick={openChangePwd}
                c="white"
                aria-label="Şifre değiştir"
              >
                Şifre değiştir
              </Button>
            </Tooltip>
            <Tooltip label="Oturumu kapat" position="bottom">
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                leftSection={<IconLogout size={16} stroke={1.5} />}
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

      {/* Şifre değiştir modal */}
      <Modal
        opened={changePwdOpened}
        onClose={() => {
          changePwdForm.reset()
          closeChangePwd()
        }}
        title="Şifre Değiştir"
        size="sm"
      >
        <form onSubmit={changePwdForm.onSubmit(handleChangePassword)}>
          <Stack gap="md">
            <PasswordInput
              label="Mevcut şifre"
              placeholder="Mevcut şifrenizi girin"
              autoComplete="current-password"
              {...changePwdForm.getInputProps('old_password')}
            />
            <PasswordInput
              label="Yeni şifre"
              placeholder="En az 8 karakter, bir büyük bir küçük harf"
              autoComplete="new-password"
              {...changePwdForm.getInputProps('new_password')}
            />
            <PasswordInput
              label="Yeni şifre (tekrar)"
              placeholder="Yeni şifrenizi tekrar girin"
              autoComplete="new-password"
              {...changePwdForm.getInputProps('new_password_confirm')}
            />
            <Button type="submit" loading={submitting} fullWidth variant="filled">
              Şifreyi güncelle
            </Button>
          </Stack>
        </form>
      </Modal>
    </Box>
  )
}
