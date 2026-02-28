// ============================================================
// PageManagementPage - Rol bazlı sayfa izinleri (role_page_access)
//
// Sorumlulukları:
// 1. system: Rol varsayılanları (superadmin, admin, user) — hangi sayfalar atanabilir
// 2. superadmin: Kendine verilen sayfaları admin/user için açıp kapatır
// 3. admin: Kendine verilen sayfaları user için açıp kapatır. Kullanıcıya özel izin yok.
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Title,
  Text,
  Stack,
  Card,
  SegmentedControl,
  Checkbox,
  Group,
  Loader,
  Center,
  Alert,
  Button,
  Tooltip
} from '@mantine/core'
import { IconShield, IconEye } from '@tabler/icons-react'
import { authApi } from '@renderer/lib/api'
import { handleApiResponse } from '@renderer/lib/notifications'
import { useAuth } from '@renderer/hooks/useAuth'
import { PAGES_REQUIRING_PERMISSION } from '@shared/utils'
import type { UserRole } from '@shared/types'

/** Menüdeki sayfa anahtarı -> görünen etiket (routes ile senkron) */
const MENU_PAGE_LABELS: Record<string, string> = {
  dashboard: 'Ana Sayfa',
  'incoming-documents': 'Gelen Evraklar',
  'outgoing-documents': 'Giden Evraklar',
  'transit-documents': 'Transit Evraklar',
  'user-management': 'Kullanıcı Yönetimi',
  'page-management': 'Sayfa Yönetimi',
  settings: 'Ayarlar',
  'settings-units': 'Birlik Ayarları',
  'settings-classifications': 'Gizlilik Ayarları',
  'settings-channels': 'Kanal Ayarları',
  'settings-folders': 'Klasör Ayarları',
  'settings-categories': 'Kategori Ayarları',
  logs: 'Sistem Logları',
  'courier-delivered': 'Teslim Edilen Evrak/Mesajlar',
  'courier-not-delivered': 'Teslim Edilmeyen Evrak/Mesajlar',
  'settings-app-general': 'Genel Ayarlar',
  'settings-postal-stamps': 'Posta Pul Ayarları',
  'postal-service': 'Posta Hizmetleri'
}

type RoleForDefaults = 'superadmin' | 'admin' | 'user'

export default function PageManagementPage(): React.JSX.Element {
  const { state: authState } = useAuth()
  const currentUser = authState.user ?? null
  const isSystem = currentUser?.role === 'system'
  const isSuperadmin = currentUser?.role === 'superadmin'
  const isAdmin = currentUser?.role === 'admin'

  const [roleDefaultsSection, setRoleDefaultsSection] = useState<RoleForDefaults>('user')
  const [roleDefaultsPages, setRoleDefaultsPages] = useState<string[]>([])
  const [loadingRoleDefaults, setLoadingRoleDefaults] = useState(false)
  const [savingRoleDefaults, setSavingRoleDefaults] = useState(false)

  const [roleVisibilityTarget, setRoleVisibilityTarget] = useState<'admin' | 'user'>('user')
  /** Tüm gösterilecek sayfalar (atanabilir + hedef rolün mevcut sayfaları) */
  const [roleVisibilityAllowedKeys, setRoleVisibilityAllowedKeys] = useState<string[]>([])
  /** Aktörün açıp kapatabildiği sayfalar (enabled checkbox'lar) */
  const [roleVisibilityAssignableKeys, setRoleVisibilityAssignableKeys] = useState<string[]>([])
  const [roleVisibilityData, setRoleVisibilityData] = useState<
    { page_key: string; can_access: boolean }[]
  >([])
  const [loadingRoleVisibility, setLoadingRoleVisibility] = useState(false)
  const [savingRoleVisibility, setSavingRoleVisibility] = useState(false)

  const canManageRoleDefaults = isSystem
  const canManageRoleVisibility = isSuperadmin || isAdmin

  const fetchRolePageDefaults = useCallback(
    async (role: RoleForDefaults): Promise<void> => {
      if (!canManageRoleDefaults) return
      setLoadingRoleDefaults(true)
      const res = await authApi.getRolePageDefaults(role)
      if (res.success && res.data) {
        setRoleDefaultsPages(res.data)
      } else {
        handleApiResponse(res)
      }
      setLoadingRoleDefaults(false)
    },
    [canManageRoleDefaults]
  )

  const saveRolePageDefaults = useCallback(async (): Promise<void> => {
    if (!currentUser || !canManageRoleDefaults) return
    setSavingRoleDefaults(true)
    const res = await authApi.setRolePageDefaults({
      role: roleDefaultsSection,
      page_keys: roleDefaultsPages,
      set_by: currentUser.id
    })
    handleApiResponse(res, { showSuccess: true, successMessage: 'Rol varsayılanları kaydedildi' })
    setSavingRoleDefaults(false)
  }, [currentUser, canManageRoleDefaults, roleDefaultsSection, roleDefaultsPages])

  useEffect(() => {
    if (canManageRoleDefaults) {
      void Promise.resolve().then(() => fetchRolePageDefaults(roleDefaultsSection))
    }
  }, [canManageRoleDefaults, roleDefaultsSection, fetchRolePageDefaults])

  const fetchRoleVisibility = useCallback(async (): Promise<void> => {
    if (!canManageRoleVisibility || !currentUser) return
    setLoadingRoleVisibility(true)
    const targetRole = isAdmin ? 'user' : roleVisibilityTarget
    const [defaultsRes, assignableRes] = await Promise.all([
      authApi.getRoleVisibilityDefaults(targetRole),
      authApi.getAssignablePagesForRole(currentUser.id, targetRole)
    ])
    const assignableKeys = assignableRes.success && assignableRes.data ? assignableRes.data : []
    setRoleVisibilityAssignableKeys(assignableKeys)
    setRoleVisibilityAllowedKeys(assignableKeys)
    if (defaultsRes.success && defaultsRes.data) {
      setRoleVisibilityData(defaultsRes.data)
    }
    setLoadingRoleVisibility(false)
  }, [canManageRoleVisibility, currentUser, isAdmin, roleVisibilityTarget])

  useEffect(() => {
    if (canManageRoleVisibility) {
      void Promise.resolve().then(() => fetchRoleVisibility())
    }
  }, [canManageRoleVisibility, fetchRoleVisibility, roleVisibilityTarget, isAdmin])

  const saveRoleVisibility = useCallback(async (): Promise<void> => {
    if (!currentUser || !canManageRoleVisibility) return
    setSavingRoleVisibility(true)
    const targetRole = isAdmin ? 'user' : roleVisibilityTarget
    const defaults = roleVisibilityAssignableKeys.map((page_key) => ({
      page_key,
      can_access: roleVisibilityData.find((p) => p.page_key === page_key)?.can_access ?? false
    }))
    const res = await authApi.setRoleVisibilityDefaults({
      target_role: targetRole,
      defaults,
      actor_id: currentUser.id
    })
    handleApiResponse(res, {
      showSuccess: true,
      successMessage: 'Rol varsayılan görünürlüğü kaydedildi'
    })
    if (res.success) void fetchRoleVisibility()
    setSavingRoleVisibility(false)
  }, [
    currentUser,
    canManageRoleVisibility,
    isAdmin,
    roleVisibilityTarget,
    roleVisibilityAssignableKeys,
    roleVisibilityData,
    fetchRoleVisibility
  ])

  const toggleRoleVisibility = useCallback((pageKey: string, canAccess: boolean): void => {
    setRoleVisibilityData((prev) => {
      const existing = prev.find((p) => p.page_key === pageKey)
      if (existing)
        return prev.map((p) => (p.page_key === pageKey ? { ...p, can_access: canAccess } : p))
      return [...prev, { page_key: pageKey, can_access: canAccess }]
    })
  }, [])

  const toggleRoleDefault = useCallback((pageKey: string, checked: boolean): void => {
    setRoleDefaultsPages((prev) =>
      checked ? [...prev, pageKey].sort() : prev.filter((k) => k !== pageKey)
    )
  }, [])

  if (!currentUser || (currentUser.role as UserRole) === 'user') {
    return (
      <Stack gap="md">
        <Title order={3}>Sayfa Yönetimi</Title>
        <Alert color="red">Bu sayfaya erişim yetkiniz bulunmuyor.</Alert>
      </Stack>
    )
  }

  return (
    <Stack gap="lg">
      <Title order={3}>Sayfa Yönetimi</Title>

      {canManageRoleDefaults && (
        <Card withBorder padding="md" radius="md">
          <Group mb="sm">
            <IconShield size={20} />
            <Text fw={600}>Rol varsayılanları (sistem)</Text>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Her rol için hangi sayfaların atanabilir olacağını belirleyin. Superadmin ve admin
            kullanıcılara sadece burada işaretli sayfalar atanabilir.
          </Text>
          <SegmentedControl
            value={roleDefaultsSection}
            onChange={(v) => setRoleDefaultsSection(v as RoleForDefaults)}
            data={[
              { value: 'superadmin', label: 'Süper Admin' },
              { value: 'admin', label: 'Admin' },
              { value: 'user', label: 'Kullanıcı' }
            ]}
            mb="md"
          />
          {loadingRoleDefaults ? (
            <Center py="xl">
              <Loader size="sm" />
            </Center>
          ) : (
            <Stack gap="xs">
              {PAGES_REQUIRING_PERMISSION.map((key) => (
                <Checkbox
                  key={key}
                  label={MENU_PAGE_LABELS[key] ?? key}
                  checked={roleDefaultsPages.includes(key)}
                  onChange={(e) => toggleRoleDefault(key, e.currentTarget.checked)}
                />
              ))}
              <Group mt="sm">
                <Button
                  onClick={saveRolePageDefaults}
                  loading={savingRoleDefaults}
                  variant="filled"
                >
                  Kaydet
                </Button>
              </Group>
            </Stack>
          )}
        </Card>
      )}

      {canManageRoleVisibility && (
        <Card withBorder padding="md" radius="md">
          <Group mb="sm">
            <IconEye size={20} />
            <Text fw={600}>Rol varsayılan görünürlüğü</Text>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Bir altındaki rollere varsayılan olarak hangi sayfaların açık/kapalı olacağını
            belirleyin. Üst rolün verdiği sayfa izinleri doğrultusunda.
          </Text>
          {isSuperadmin && (
            <SegmentedControl
              value={roleVisibilityTarget}
              onChange={(v) => setRoleVisibilityTarget(v as 'admin' | 'user')}
              data={[
                { value: 'admin', label: 'Admin rolü' },
                { value: 'user', label: 'Kullanıcı rolü' }
              ]}
              mb="md"
            />
          )}
          {loadingRoleVisibility ? (
            <Center py="xl">
              <Loader size="sm" />
            </Center>
          ) : roleVisibilityAllowedKeys.length === 0 ? (
            <Alert color="blue">
              {isAdmin
                ? 'Superadmin önce user rolü için varsayılan atamalı.'
                : 'Sistem önce bu rol için atanabilir sayfaları (Rol varsayılanları) tanımlamalı.'}
            </Alert>
          ) : (
            <Stack gap="xs">
              {roleVisibilityAllowedKeys.map((pageKey) => {
                const canAssign = roleVisibilityAssignableKeys.includes(pageKey)
                const checkbox = (
                  <Checkbox
                    key={pageKey}
                    label={MENU_PAGE_LABELS[pageKey] ?? pageKey}
                    checked={
                      roleVisibilityData.find((p) => p.page_key === pageKey)?.can_access ?? false
                    }
                    disabled={!canAssign}
                    onChange={(e) => toggleRoleVisibility(pageKey, e.currentTarget.checked)}
                  />
                )
                return canAssign ? (
                  checkbox
                ) : (
                  <Tooltip
                    key={pageKey}
                    label="Bu sayfaya sizin yetkiniz yok; alt rolün mevcut izni değiştirilmedi."
                    multiline
                    maw={280}
                  >
                    <div>{checkbox}</div>
                  </Tooltip>
                )
              })}
              <Group mt="sm">
                <Button
                  onClick={saveRoleVisibility}
                  loading={savingRoleVisibility}
                  variant="filled"
                >
                  Kaydet
                </Button>
              </Group>
            </Stack>
          )}
        </Card>
      )}
    </Stack>
  )
}
