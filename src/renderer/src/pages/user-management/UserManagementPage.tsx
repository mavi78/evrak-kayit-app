// ============================================================
// UserManagementPage - Kullanıcı yönetimi sayfası
// İleri aşamada kullanıcı CRUD ve izin yönetimi yapılacak
// ============================================================

import { Title, Text, Stack, Card } from '@mantine/core'

export default function UserManagementPage(): React.JSX.Element {
  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Kullanıcı Yönetimi</Title>
        <Text c="dimmed" mt={4}>
          Kullanıcı oluşturma, düzenleme ve izin yönetimi
        </Text>
      </div>

      <Card>
        <Text c="dimmed" ta="center" py="xl">
          Kullanıcı yönetimi modülü bir sonraki adımda detaylı olarak oluşturulacaktır.
        </Text>
      </Card>
    </Stack>
  )
}
