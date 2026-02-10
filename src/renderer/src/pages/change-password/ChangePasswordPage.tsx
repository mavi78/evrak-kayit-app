// ============================================================
// ChangePasswordPage - Zorunlu şifre değiştirme (ilk giriş / başkası değiştirdiyse)
// must_change_password true iken giriş sonrası bu sayfaya yönlendirilir.
// Yeni şifre güncellenmeden sisteme erişim verilmez.
// ============================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paper, Title, Text, PasswordInput, Button, Stack, Alert, Box } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconKey, IconAlertCircle } from '@tabler/icons-react'
import { useAuth } from '@renderer/hooks/useAuth'
import { authApi } from '@renderer/lib/api'
import { handleApiResponse } from '@renderer/lib/notifications'
import { validatePassword } from '@shared/utils'

interface FormValues {
  old_password: string
  new_password: string
  new_password_confirm: string
}

export default function ChangePasswordPage(): React.JSX.Element {
  const { state, refreshPermissions } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const form = useForm<FormValues>({
    initialValues: {
      old_password: '',
      new_password: '',
      new_password_confirm: ''
    },
    validate: {
      old_password: (v) => (!v?.trim() ? 'Mevcut şifre zorunludur' : null),
      new_password: (v) => validatePassword(v ?? '') ?? null,
      new_password_confirm: (v, values) =>
        v !== values.new_password ? 'Yeni şifre ile eşleşmiyor' : null
    }
  })

  const handleSubmit = async (values: FormValues): Promise<void> => {
    if (!state.user) return
    setLoading(true)
    const response = await authApi.changePassword({
      user_id: state.user.id,
      new_password: values.new_password,
      changed_by: state.user.id,
      old_password: values.old_password
    })
    handleApiResponse(response, {
      showSuccess: true,
      successMessage: 'Şifre başarıyla değiştirildi'
    })
    if (response.success) {
      await refreshPermissions()
      navigate('/dashboard', { replace: true })
    }
    setLoading(false)
  }

  return (
    <Box
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--mantine-spacing-md)'
      }}
    >
      <Paper
        shadow="md"
        p="xl"
        radius="md"
        maw={400}
        w="100%"
        mx="md"
        withBorder
        style={{
          borderColor: 'var(--mantine-color-deniz-4)',
          borderWidth: 1
        }}
      >
        <Box ta="center" mb="lg">
          <Box
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 'var(--mantine-radius-md)',
              background: 'var(--mantine-color-orange-1)',
              border: '1px solid var(--mantine-color-orange-4)',
              marginBottom: 'var(--mantine-spacing-md)'
            }}
          >
            <IconKey size={32} stroke={1.5} color="var(--mantine-color-orange-7)" />
          </Box>
          <Title order={2} c="var(--mantine-color-deniz-8)" mb={4}>
            Şifrenizi Değiştirin
          </Title>
          <Text c="dimmed" size="sm">
            Devam etmek için yeni bir şifre belirlemeniz gerekiyor.
          </Text>
        </Box>

        <Alert
          icon={<IconAlertCircle size={18} />}
          color="orange"
          variant="light"
          mb="md"
          radius="sm"
        >
          Şifreniz yönetici tarafından değiştirildi. Sisteme erişmek için yeni şifrenizi girin.
        </Alert>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <PasswordInput
              label="Mevcut şifre"
              placeholder="Şu an kullandığınız şifre"
              autoComplete="current-password"
              {...form.getInputProps('old_password')}
            />
            <PasswordInput
              label="Yeni şifre"
              placeholder="En az 8 karakter, bir büyük bir küçük harf"
              autoComplete="new-password"
              {...form.getInputProps('new_password')}
            />
            <PasswordInput
              label="Yeni şifre (tekrar)"
              placeholder="Yeni şifrenizi tekrar girin"
              autoComplete="new-password"
              {...form.getInputProps('new_password_confirm')}
            />
            <Button type="submit" fullWidth size="md" mt="sm" loading={loading} color="deniz">
              Şifreyi güncelle ve devam et
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  )
}
