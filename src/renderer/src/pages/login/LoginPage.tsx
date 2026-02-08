// ============================================================
// LoginPage - Giriş sayfası (TSK kurumsal tasarım)
// Ana layout içinde; TSK yeşil/lacivert tema ile form alanı.
// ============================================================

import { useState } from 'react'
import {
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Alert,
  Box,
  Divider
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconLogin, IconAlertCircle, IconShieldLock } from '@tabler/icons-react'
import { useAuth } from '@renderer/hooks/useAuth'
import type { LoginRequest } from '@shared/types'

export default function LoginPage(): React.JSX.Element {
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const form = useForm<LoginRequest>({
    initialValues: {
      username: '',
      password: ''
    },
    validate: {
      username: (value) => (value.trim().length === 0 ? 'Kullanıcı adı zorunludur' : null),
      password: (value) => (value.length === 0 ? 'Şifre zorunludur' : null)
    }
  })

  const handleSubmit = async (values: LoginRequest): Promise<void> => {
    setError(null)
    setLoading(true)

    try {
      const response = await login(values)
      if (!response.success) {
        setError(response.message)
      }
    } catch {
      setError('Bağlantı hatası oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
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
        {/* TSK başlık alanı */}
        <Box ta="center" mb="lg">
          <Box
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 'var(--mantine-radius-md)',
              background: 'var(--mantine-color-deniz-1)',
              border: '1px solid var(--mantine-color-deniz-4)',
              marginBottom: 'var(--mantine-spacing-md)'
            }}
          >
            <IconShieldLock size={32} stroke={1.5} color="var(--mantine-color-deniz-7)" />
          </Box>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={1} mb={4}>
            Deniz Kuvvetleri Komutanlığı
          </Text>
          <Title order={2} c="var(--mantine-color-deniz-8)" mb={4}>
            Evrak Kayıt Sistemi
          </Title>
          <Text c="dimmed" size="sm">
            Devam etmek için giriş yapın
          </Text>
        </Box>

        <Divider my="md" color="var(--mantine-color-deniz-3)" />

        {/* Hata mesajı */}
        {error && (
          <Alert
            icon={<IconAlertCircle size={18} />}
            color="red"
            variant="light"
            mb="md"
            onClose={() => setError(null)}
            withCloseButton
            radius="sm"
          >
            {error}
          </Alert>
        )}

        {/* Giriş formu */}
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Kullanıcı Adı"
              placeholder="Kullanıcı adınızı girin"
              size="md"
              autoFocus
              styles={{
                label: { fontWeight: 600 }
              }}
              {...form.getInputProps('username')}
            />

            <PasswordInput
              label="Şifre"
              placeholder="Şifrenizi girin"
              size="md"
              styles={{
                label: { fontWeight: 600 }
              }}
              {...form.getInputProps('password')}
            />

            <Button
              type="submit"
              fullWidth
              size="md"
              mt="sm"
              loading={loading}
              leftSection={<IconLogin size={18} stroke={2} />}
              color="deniz"
              variant="filled"
            >
              Giriş Yap
            </Button>
          </Stack>
        </form>

        {/* Alt bilgi */}
        <Text c="dimmed" size="xs" ta="center" mt="lg">
          İlk giriş: superadmin / Admin.123
        </Text>
      </Paper>
    </Box>
  )
}
