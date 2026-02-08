// ============================================================
// CourierNotDeliveredPage - Kurye işlemleri > Teslim edilmeyen
// Placeholder sayfa; içerik sonra doldurulacak.
// ============================================================

import { Title, Text } from '@mantine/core'

export default function CourierNotDeliveredPage(): React.JSX.Element {
  return (
    <>
      <Title order={3} mb="xs">
        Teslim edilmeyen
      </Title>
      <Text size="sm" c="dimmed">
        Kurye işlemleri — teslim edilmeyen evraklar listesi burada gösterilecek.
      </Text>
    </>
  )
}
