// ============================================================
// UserManagementPage - Kullanıcı CRUD ve listeleme
//
// Sorumlulukları:
// 1. Kullanıcı listesi (tablo)
// 2. Yeni kullanıcı oluşturma (modal + form)
// 3. Kullanıcı düzenleme (modal + form)
// 4. Kullanıcı silme (onay modalı)
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Title,
  Text,
  Stack,
  Card,
  Button,
  Group,
  Table,
  Badge,
  ActionIcon,
  TextInput,
  Modal,
  Loader,
  Center,
  Select,
  Switch,
  PasswordInput,
  Tooltip
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus, IconEdit, IconTrash, IconRefresh, IconKey } from '@tabler/icons-react'
import { formatIsoToDisplayWithTime } from '@shared/utils'
import { authApi } from '@renderer/lib/api'
import { handleApiResponse, showError } from '@renderer/lib/notifications'
import { useAuth } from '@renderer/hooks/useAuth'
import { isValidTcKimlikNo, validatePassword } from '@shared/utils'
import type {
  UserWithoutPassword,
  CreateUserRequest,
  UpdateUserRequest,
  UserRole
} from '@shared/types'

const ALL_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'user', label: 'Kullanıcı' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Süper Admin' },
  { value: 'system', label: 'Sistem' }
]

/** Atanabilir roller (system arayüz/API ile atanamaz). */
const ASSIGNABLE_ROLE_OPTIONS = ALL_ROLE_OPTIONS.filter((r) => r.value !== 'system')

/** Giriş yapan kullanıcının rolüne göre atayabileceği roller (create/edit). */
function getRoleOptionsForCurrentUser(
  currentUser: UserWithoutPassword | null
): { value: UserRole; label: string }[] {
  if (!currentUser) return []
  if (currentUser.role === 'admin') return ASSIGNABLE_ROLE_OPTIONS.filter((r) => r.value === 'user')
  if (currentUser.role === 'superadmin') {
    return ASSIGNABLE_ROLE_OPTIONS.filter((r) => r.value === 'user' || r.value === 'admin')
  }
  if (currentUser.role === 'system') {
    return [...ASSIGNABLE_ROLE_OPTIONS]
  }
  return []
}

/** Yetkili kullanıcının hedef kullanıcının şifresini değiştirip değiştiremeyeceği. */
function canChangePasswordFor(
  currentUser: UserWithoutPassword | null,
  targetUser: UserWithoutPassword
): boolean {
  if (!currentUser) return false
  if (targetUser.id === currentUser.id) return false
  if (targetUser.role === 'system') return false
  if (currentUser.role === 'system') return true
  if (targetUser.role === 'superadmin') return false
  if (currentUser.role === 'admin') return targetUser.role === 'user'
  if (currentUser.role === 'superadmin')
    return targetUser.role === 'admin' || targetUser.role === 'user'
  return false
}

type CreateFormValues = CreateUserRequest
type EditFormValues = Pick<UpdateUserRequest, 'full_name' | 'rutbe' | 'role' | 'is_active'>

export default function UserManagementPage(): React.JSX.Element {
  const { state: authState } = useAuth()
  const currentUser = authState.user ?? null
  const roleOptions = getRoleOptionsForCurrentUser(currentUser)
  const canEditRole = currentUser?.role === 'superadmin'
  const [users, setUsers] = useState<UserWithoutPassword[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserWithoutPassword | null>(null)
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false)
  const [passwordOpened, { open: openPassword, close: closePassword }] = useDisclosure(false)
  const [userForPassword, setUserForPassword] = useState<UserWithoutPassword | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchUsers = useCallback(async (): Promise<void> => {
    setLoading(true)
    const response = await authApi.getAll()
    if (response.success) {
      setUsers(response.data)
    } else {
      showError(response.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchUsers()
    }, 0)
    return () => clearTimeout(t)
  }, [fetchUsers])

  const createForm = useForm<CreateFormValues>({
    initialValues: {
      tc_kimlik_no: '',
      password: '',
      full_name: '',
      rutbe: '',
      role: 'user'
    },
    validate: {
      tc_kimlik_no: (v) =>
        !v?.trim()
          ? 'TC Kimlik No zorunludur'
          : !isValidTcKimlikNo(v.trim())
            ? 'TC Kimlik No 11 rakam olmalıdır'
            : null,
      password: (v) => validatePassword(v ?? '') ?? null,
      full_name: (v) => (!v?.trim() ? 'Ad soyad zorunludur' : null),
      role: (v) => (!v ? 'Rol seçiniz' : null)
    }
  })

  const editForm = useForm<EditFormValues>({
    initialValues: {
      full_name: '',
      rutbe: '',
      role: 'user',
      is_active: true
    },
    validate: {
      full_name: (v) => (!v?.trim() ? 'Ad soyad zorunludur' : null),
      role: (v) => (!v ? 'Rol seçiniz' : null)
    }
  })

  const passwordForm = useForm<{ new_password: string; new_password_confirm: string }>({
    initialValues: { new_password: '', new_password_confirm: '' },
    validate: {
      new_password: (v) => validatePassword(v ?? '') ?? null,
      new_password_confirm: (v, values) =>
        v !== values.new_password ? 'Yeni şifre ile eşleşmiyor' : null
    }
  })

  const handleCreate = async (values: CreateFormValues): Promise<void> => {
    if (!currentUser) return
    setSubmitting(true)
    const response = await authApi.create({
      ...values,
      created_by: currentUser.id
    })
    handleApiResponse(response, { showSuccess: true, successMessage: 'Kullanıcı oluşturuldu' })
    if (response.success) {
      createForm.reset()
      closeCreate()
      fetchUsers()
    }
    setSubmitting(false)
  }

  const openEditModal = (user: UserWithoutPassword): void => {
    setSelectedUser(user)
    editForm.setValues({
      full_name: user.full_name,
      rutbe: user.rutbe ?? '',
      role: user.role,
      is_active: user.is_active
    })
    openEdit()
  }

  const handleEdit = async (values: EditFormValues): Promise<void> => {
    if (!currentUser || !selectedUser) return
    setSubmitting(true)
    const response = await authApi.update({
      id: selectedUser.id,
      ...values,
      updated_by: currentUser.id
    })
    handleApiResponse(response, { showSuccess: true, successMessage: 'Kullanıcı güncellendi' })
    if (response.success) {
      closeEdit()
      setSelectedUser(null)
      fetchUsers()
    }
    setSubmitting(false)
  }

  const handleDelete = async (): Promise<void> => {
    if (!currentUser || !selectedUser) return
    setSubmitting(true)
    const response = await authApi.delete({
      id: selectedUser.id,
      deleted_by: currentUser.id
    })
    handleApiResponse(response, { showSuccess: true, successMessage: 'Kullanıcı silindi' })
    if (response.success) {
      closeDelete()
      setSelectedUser(null)
      fetchUsers()
    }
    setSubmitting(false)
  }

  const openDeleteModal = (user: UserWithoutPassword): void => {
    setSelectedUser(user)
    openDelete()
  }

  const openPasswordModal = (user: UserWithoutPassword): void => {
    setUserForPassword(user)
    passwordForm.reset()
    openPassword()
  }

  const handleSetPassword = async (values: {
    new_password: string
    new_password_confirm: string
  }): Promise<void> => {
    if (!currentUser || !userForPassword) return
    setSubmitting(true)
    const response = await authApi.changePassword({
      user_id: userForPassword.id,
      new_password: values.new_password,
      changed_by: currentUser.id
    })
    handleApiResponse(response, {
      showSuccess: true,
      successMessage: 'Şifre başarıyla değiştirildi'
    })
    if (response.success) {
      closePassword()
      setUserForPassword(null)
      passwordForm.reset()
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <Center h="50vh">
        <Loader size="lg" type="dots" />
      </Center>
    )
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Kullanıcı Yönetimi</Title>
          <Text c="dimmed" mt={4}>
            Kullanıcı oluşturma, düzenleme ve listeleme
          </Text>
        </div>
        <Group>
          <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={fetchUsers}>
            Yenile
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Yeni Kullanıcı
          </Button>
        </Group>
      </Group>

      <Card>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>TC Kimlik No</Table.Th>
              <Table.Th>Ad Soyad</Table.Th>
              <Table.Th>Rütbe</Table.Th>
              <Table.Th>Rol</Table.Th>
              <Table.Th>Durum</Table.Th>
              <Table.Th>Son güncelleme</Table.Th>
              <Table.Th w={120}>İşlemler</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users.map((user) => (
              <Table.Tr key={user.id}>
                <Table.Td>{user.tc_kimlik_no}</Table.Td>
                <Table.Td>{user.full_name}</Table.Td>
                <Table.Td>{user.rutbe || '—'}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color="blue" size="sm">
                    {ALL_ROLE_OPTIONS.find((r) => r.value === user.role)?.label ?? user.role}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={user.is_active ? 'green' : 'gray'} variant="light" size="sm">
                    {user.is_active ? 'Aktif' : 'Pasif'}
                  </Badge>
                </Table.Td>
                <Table.Td>{formatIsoToDisplayWithTime(user.updated_at)}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip
                      label={
                        user.role === 'system'
                          ? 'Sistem kullanıcısı düzenlenemez'
                          : user.id === currentUser?.id
                            ? 'Kendi bilgilerinizi buradan güncelleyemezsiniz'
                            : currentUser?.role === 'superadmin' && user.role === 'superadmin'
                              ? 'Superadmin, superadmin rolündekiler üzerinde işlem yapamaz'
                              : currentUser?.role === 'admin' && user.role !== 'user'
                                ? 'Admin sadece kullanıcı rolündekileri düzenleyebilir'
                                : 'Düzenle'
                      }
                      position="top"
                    >
                      <span style={{ display: 'inline-flex' }}>
                        <ActionIcon
                          variant="light"
                          color="blue"
                          size="sm"
                          disabled={
                            user.role === 'system' ||
                            user.id === currentUser?.id ||
                            (currentUser?.role === 'superadmin' && user.role === 'superadmin') ||
                            (currentUser?.role === 'admin' && user.role !== 'user')
                          }
                          onClick={() => openEditModal(user)}
                          aria-label="Düzenle"
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </span>
                    </Tooltip>
                    <Tooltip
                      label={
                        canChangePasswordFor(currentUser, user)
                          ? 'Şifreyi değiştir'
                          : user.role === 'system'
                            ? 'Sistem kullanıcısının şifresi yalnızca kendisi tarafından (header) değiştirilebilir'
                            : user.id === currentUser?.id
                              ? "Kendi şifrenizi header'dan değiştirin"
                              : user.role === 'superadmin'
                                ? 'Superadmin şifresi yalnızca kendisi tarafından değiştirilebilir'
                                : 'Bu kullanıcının şifresini değiştirme yetkiniz yok'
                      }
                      position="top"
                    >
                      <span style={{ display: 'inline-flex' }}>
                        <ActionIcon
                          variant="light"
                          color="gray"
                          size="sm"
                          disabled={!canChangePasswordFor(currentUser, user)}
                          onClick={() => openPasswordModal(user)}
                          aria-label="Şifre değiştir"
                        >
                          <IconKey size={16} />
                        </ActionIcon>
                      </span>
                    </Tooltip>
                    <Tooltip
                      label={
                        user.role === 'system'
                          ? 'Sistem kullanıcısı asla silinemez'
                          : user.id === currentUser?.id
                            ? 'Kendinizi silemezsiniz'
                            : user.role === 'superadmin' && currentUser?.role !== 'system'
                              ? 'Superadmin yalnızca sistem kullanıcısı tarafından silinebilir'
                              : currentUser?.role === 'admin' && user.role !== 'user'
                                ? 'Admin sadece kullanıcı rolündekileri silebilir'
                                : 'Sil'
                      }
                      position="top"
                    >
                      <span style={{ display: 'inline-flex' }}>
                        <ActionIcon
                          variant="light"
                          color="red"
                          size="sm"
                          disabled={
                            user.role === 'system' ||
                            (user.role === 'superadmin' && currentUser?.role !== 'system') ||
                            user.id === currentUser?.id ||
                            (currentUser?.role === 'admin' && user.role !== 'user')
                          }
                          onClick={() => openDeleteModal(user)}
                          aria-label="Sil"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </span>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {users.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            Henüz kullanıcı bulunmuyor
          </Text>
        )}
      </Card>

      {/* Oluşturma Modal */}
      <Modal opened={createOpened} onClose={closeCreate} title="Yeni Kullanıcı" size="sm">
        <form onSubmit={createForm.onSubmit(handleCreate)}>
          <Stack gap="md">
            <TextInput
              label="TC Kimlik No"
              placeholder="11 rakam"
              maxLength={11}
              {...createForm.getInputProps('tc_kimlik_no')}
            />
            <TextInput
              type="password"
              label="Şifre"
              placeholder="En az 8 karakter, bir büyük bir küçük harf"
              {...createForm.getInputProps('password')}
            />
            <TextInput
              label="Ad Soyad"
              placeholder="Ad Soyad"
              {...createForm.getInputProps('full_name')}
            />
            <TextInput
              label="Rütbe"
              placeholder="Opsiyonel"
              {...createForm.getInputProps('rutbe')}
            />
            <Select label="Rol" data={roleOptions} {...createForm.getInputProps('role')} />
            <Button type="submit" loading={submitting} fullWidth>
              Kaydet
            </Button>
          </Stack>
        </form>
      </Modal>

      {/* Düzenleme Modal */}
      <Modal
        opened={editOpened}
        onClose={() => {
          closeEdit()
          setSelectedUser(null)
        }}
        title="Kullanıcı Düzenle"
        size="sm"
      >
        <form onSubmit={editForm.onSubmit(handleEdit)}>
          <Stack gap="md">
            {selectedUser && (
              <Text size="sm" c="dimmed">
                TC Kimlik No: {selectedUser.tc_kimlik_no}
              </Text>
            )}
            <TextInput
              label="Ad Soyad"
              placeholder="Ad Soyad"
              {...editForm.getInputProps('full_name')}
            />
            <TextInput label="Rütbe" placeholder="Opsiyonel" {...editForm.getInputProps('rutbe')} />
            {canEditRole && (
              <Select label="Rol" data={roleOptions} {...editForm.getInputProps('role')} />
            )}
            {!canEditRole && selectedUser && (
              <Text size="sm" c="dimmed">
                Rol:{' '}
                {ALL_ROLE_OPTIONS.find((r) => r.value === selectedUser.role)?.label ??
                  selectedUser.role}{' '}
                (değiştirilemez)
              </Text>
            )}
            <Switch label="Aktif" {...editForm.getInputProps('is_active', { type: 'checkbox' })} />
            <Button type="submit" loading={submitting} fullWidth>
              Güncelle
            </Button>
          </Stack>
        </form>
      </Modal>

      {/* Silme Onay Modal */}
      <Modal
        opened={deleteOpened}
        onClose={() => {
          closeDelete()
          setSelectedUser(null)
        }}
        title="Kullanıcıyı Sil"
        size="sm"
      >
        <Text>
          <strong>{selectedUser?.full_name}</strong> ({selectedUser?.tc_kimlik_no}) kullanıcısını
          silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
        </Text>
        <Group mt="md" justify="flex-end">
          <Button
            variant="default"
            onClick={() => {
              closeDelete()
              setSelectedUser(null)
            }}
          >
            İptal
          </Button>
          <Button color="red" onClick={handleDelete} loading={submitting}>
            Sil
          </Button>
        </Group>
      </Modal>

      {/* Başka kullanıcının şifresini değiştir modal */}
      <Modal
        opened={passwordOpened}
        onClose={() => {
          closePassword()
          setUserForPassword(null)
          passwordForm.reset()
        }}
        title={userForPassword ? `Şifre değiştir: ${userForPassword.full_name}` : 'Şifre değiştir'}
        size="sm"
      >
        {userForPassword && (
          <form onSubmit={passwordForm.onSubmit(handleSetPassword)}>
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                TC Kimlik No: {userForPassword.tc_kimlik_no}
              </Text>
              <PasswordInput
                label="Yeni şifre"
                placeholder="En az 8 karakter, bir büyük bir küçük harf"
                autoComplete="new-password"
                {...passwordForm.getInputProps('new_password')}
              />
              <PasswordInput
                label="Yeni şifre (tekrar)"
                placeholder="Yeni şifrenizi tekrar girin"
                autoComplete="new-password"
                {...passwordForm.getInputProps('new_password_confirm')}
              />
              <Button type="submit" loading={submitting} fullWidth>
                Şifreyi güncelle
              </Button>
            </Stack>
          </form>
        )}
      </Modal>
    </Stack>
  )
}
