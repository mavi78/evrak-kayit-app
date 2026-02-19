// ============================================================
// AppSettingsPage - Genel uygulama ayarları
//
// Sorumlulukları:
// 1. Birlik seçimi — uygulamayı kullanan birliği kaydetme
// 2. Basit form + Select bileşeni
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Title,
  Text,
  Stack,
  Card,
  Button,
  Group,
  Select,
  Loader,
  Center,
  Badge,
  useMantineTheme
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconDeviceFloppy, IconBuilding } from '@tabler/icons-react'
import { appSettingsApi, unitApi } from '@renderer/lib/api'
import { APP_SETTING_KEYS } from '@shared/types'
import type { Unit } from '@shared/types'

export default function AppSettingsPage(): React.JSX.Element {
  const theme = useMantineTheme()

  // State
  const [units, setUnits] = useState<Unit[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [currentUnitName, setCurrentUnitName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Birlikleri ve mevcut ayarı yükle
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [unitsRes, settingRes] = await Promise.all([
        unitApi.getAll(),
        appSettingsApi.getOrganization()
      ])

      if (unitsRes.success && unitsRes.data) {
        setUnits(unitsRes.data)
      }

      if (settingRes.success && settingRes.data?.value) {
        setSelectedUnitId(settingRes.data.value)
        // Birlik adını bul
        const unit = unitsRes.data?.find((u) => u.id === Number(settingRes.data?.value))
        setCurrentUnitName(unit?.name ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Kaydet
  const handleSave = useCallback(async () => {
    if (!selectedUnitId) {
      notifications.show({
        title: 'Uyarı',
        message: 'Lütfen bir birlik seçin',
        color: 'yellow'
      })
      return
    }

    setSaving(true)
    try {
      const res = await appSettingsApi.set({
        key: APP_SETTING_KEYS.ORGANIZATION_UNIT_ID,
        value: selectedUnitId
      })

      if (res.success) {
        const unit = units.find((u) => u.id === Number(selectedUnitId))
        setCurrentUnitName(unit?.name ?? null)
        notifications.show({
          title: 'Başarılı',
          message: 'Birlik ayarı kaydedildi',
          color: 'green'
        })
      } else {
        notifications.show({
          title: 'Hata',
          message: res.message || 'Ayar kaydedilemedi',
          color: 'red'
        })
      }
    } finally {
      setSaving(false)
    }
  }, [selectedUnitId, units])

  // Aktif birlik listesi (Select verisi)
  const unitSelectData = units
    .filter((u) => u.is_active)
    .map((u) => ({
      value: String(u.id),
      label: u.name
    }))

  if (loading) {
    return (
      <Center h="100%">
        <Loader size="lg" />
      </Center>
    )
  }

  return (
    <Stack gap="md" p="md" style={{ maxWidth: 700 }}>
      <Title order={3}>Genel Ayarlar</Title>
      <Text size="sm" c="dimmed">
        Uygulamanın bağlı olduğu birliği seçin. Bu ayar uygulama genelinde kullanılır.
      </Text>

      <Card
        shadow="sm"
        radius="md"
        padding="lg"
        withBorder
        style={{
          borderColor: theme.colors.deniz[2],
          background: `linear-gradient(135deg, ${theme.white} 0%, ${theme.colors.deniz[0]} 100%)`
        }}
      >
        <Stack gap="md">
          <Group gap="sm">
            <IconBuilding size={22} color={theme.colors.deniz[6]} />
            <Text fw={600} size="md">
              Birlik Ayarı
            </Text>
          </Group>

          {currentUnitName && (
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Mevcut birlik:
              </Text>
              <Badge variant="light" color="deniz" size="lg">
                {currentUnitName}
              </Badge>
            </Group>
          )}

          <Select
            label="Birlik seçin"
            placeholder="Birlik arayın..."
            data={unitSelectData}
            value={selectedUnitId}
            onChange={setSelectedUnitId}
            searchable
            nothingFoundMessage="Birlik bulunamadı"
            clearable
          />

          <Group justify="flex-end" mt="sm">
            <Button
              leftSection={<IconDeviceFloppy size={18} />}
              onClick={handleSave}
              loading={saving}
              color="deniz"
            >
              Kaydet
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  )
}
