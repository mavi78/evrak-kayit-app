// ============================================================
// DashboardPage - Ana sayfa
// Genel bakış ve istatistikler gösterilecek
// ============================================================

import { Title, Text, SimpleGrid, Card, Group, ThemeIcon, Stack } from '@mantine/core'
import {
  IconFileImport,
  IconFileExport,
  IconArrowsTransferDown,
  IconUsers
} from '@tabler/icons-react'
import { useAuth } from '@renderer/hooks/useAuth'

interface StatCardProps {
  title: string
  value: string
  icon: React.ReactNode
  color: string
}

function StatCard({ title, value, icon, color }: StatCardProps): React.JSX.Element {
  return (
    <Card>
      <Group>
        <ThemeIcon size="xl" radius="md" variant="light" color={color}>
          {icon}
        </ThemeIcon>
        <Stack gap={0}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            {title}
          </Text>
          <Text size="xl" fw={700}>
            {value}
          </Text>
        </Stack>
      </Group>
    </Card>
  )
}

export default function DashboardPage(): React.JSX.Element {
  const { state } = useAuth()

  return (
    <Stack gap="lg">
      {/* Hoşgeldin mesajı */}
      <div>
        <Title order={2}>Hoş Geldiniz</Title>
        <Text c="dimmed" mt={4}>
          {state.user?.full_name} - Evrak Kayıt Sistemi
        </Text>
      </div>

      {/* İstatistik kartları */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <StatCard title="Gelen Evrak" value="0" icon={<IconFileImport size={24} />} color="blue" />
        <StatCard title="Giden Evrak" value="0" icon={<IconFileExport size={24} />} color="green" />
        <StatCard
          title="Transit Evrak"
          value="0"
          icon={<IconArrowsTransferDown size={24} />}
          color="orange"
        />
        <StatCard title="Kullanıcılar" value="0" icon={<IconUsers size={24} />} color="grape" />
      </SimpleGrid>

      {/* İleri aşamada buraya son evraklar, grafikler eklenecek */}
      <Card>
        <Text c="dimmed" ta="center" py="xl">
          Evrak modülleri eklendiğinde burada son işlemler ve istatistikler görüntülenecektir.
        </Text>
      </Card>
    </Stack>
  )
}
