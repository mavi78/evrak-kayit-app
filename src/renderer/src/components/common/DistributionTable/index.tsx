// ============================================================
// DistributionTable - Havale/dağıtım listesi (ortak bileşen)
// 3 sayfa tarafından kullanılır: Gelen, Giden, Transit
// BİRLİK ADI, DAĞITIM ŞEKLİ, TESLİM DURUMU, TESLİM TARİHİ, SENT NO
// Sağ tık menüsü ile dağıtım şekli (kanal) değiştirilebilir ve dağıtım silinebilir.
// ============================================================

import { useState } from 'react'
import { Table, Text, ScrollArea, Badge, Box, Menu, Divider } from '@mantine/core'
import {
  IconCheck,
  IconLock,
  IconArrowsExchange,
  IconTrash,
  IconAlertTriangle
} from '@tabler/icons-react'
import type { DocumentDistribution, Unit, Channel } from '@shared/types'

export interface DistributionTableProps {
  distributions: DocumentDistribution[]
  units: Unit[]
  channels: Channel[]
  /** Kanal değişikliği callback'i — teslim edilmemiş satırlarda çağrılır */
  onChannelChange?: (distributionId: number, newChannelId: number) => void
  /** Dağıtım silme callback'i — forcePostalDelete: posta zarfına bağlıysa onaylanmış demek */
  onDeleteDistribution?: (distributionId: number, forcePostalDelete?: boolean) => void
}

/** Sağ tık menü state */
interface ContextMenuState {
  distribution: DocumentDistribution
  x: number
  y: number
}

/**
 * Seçili evrakın havale/dağıtım listesini gösterir.
 * Maksimum 4 satır yüksekliğinde, sayfa altında sabit kart içinde.
 * 3 sayfa tarafından ortak kullanılır — scope backend'de filtrelenir.
 * Sağ tık ile dağıtım şekli değiştirilebilir ve dağıtım silinebilir.
 */
export function DistributionTable({
  distributions,
  units,
  channels,
  onChannelChange,
  onDeleteDistribution
}: DistributionTableProps): React.JSX.Element {
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)

  const getUnitName = (unitId: number): string => {
    const u = units.find((x) => x.id === unitId)
    return u?.short_name ?? u?.name ?? String(unitId)
  }

  const getChannelName = (channelId: number): string => {
    const c = channels.find((x) => x.id === channelId)
    return c?.name ?? String(channelId)
  }

  /** Dağıtım kanalı kilitli mi (Kurye/Posta — teslim edildiyse değiştirilemez) */
  const isLockedChannel = (channelId: number): boolean => {
    const c = channels.find((x) => x.id === channelId)
    if (!c) return false
    const locked = ['posta', 'kurye']
    return locked.includes(c.name.toLowerCase())
  }

  /** Kanal değiştirme engelli mi? (Kurye/Posta + teslim edilmiş) */
  const isChannelChangeLocked = (d: DocumentDistribution): boolean =>
    d.is_delivered && isLockedChannel(d.channel_id)

  const activeChannels = channels.filter((c) => c.is_active)

  const handleRowContextMenu = (d: DocumentDistribution, e: React.MouseEvent): void => {
    e.preventDefault()
    setCtxMenu({ distribution: d, x: e.clientX, y: e.clientY })
  }

  const handleChannelSelect = (newChannelId: number): void => {
    if (!ctxMenu || !onChannelChange) return
    // Mevcut kanal ile aynıysa işlem yapma
    if (ctxMenu.distribution.channel_id === newChannelId) return
    onChannelChange(ctxMenu.distribution.id, newChannelId)
    setCtxMenu(null)
  }

  const handleDelete = (): void => {
    if (!ctxMenu || !onDeleteDistribution) return
    const dist = ctxMenu.distribution
    const isPostal = isLockedChannel(dist.channel_id) && dist.is_delivered
    onDeleteDistribution(dist.id, isPostal)
    setCtxMenu(null)
  }

  if (distributions.length === 0) {
    return (
      <Text size="sm" c="dimmed" py="md" ta="center">
        Dağıtım kaydı yok.
      </Text>
    )
  }

  return (
    <>
      <ScrollArea
        h={130}
        scrollbarSize={4}
        type="hover"
        styles={{ viewport: { overflowX: 'hidden' } }}
      >
        <Table
          stickyHeader
          striped
          highlightOnHover
          fz="xs"
          styles={{
            table: { borderCollapse: 'separate', borderSpacing: 0 },
            thead: {
              background:
                'linear-gradient(180deg, var(--mantine-color-deniz-4) 0%, var(--mantine-color-deniz-6) 50%, var(--mantine-color-deniz-8) 100%)',
              boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.1)',
              borderBottom: '1px solid var(--mantine-color-deniz-7)'
            },
            th: {
              padding: '4px 8px',
              fontWeight: 800,
              fontSize: '0.68rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--mantine-color-deniz-0)',
              background:
                'linear-gradient(180deg, var(--mantine-color-deniz-4) 0%, var(--mantine-color-deniz-6) 50%, var(--mantine-color-deniz-8) 100%)',
              borderBottom: 'none'
            },
            td: {
              padding: '4px 8px',
              fontSize: '0.72rem'
            }
          }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th
                style={{ textAlign: 'center', borderTopLeftRadius: 'var(--mantine-radius-sm)' }}
              >
                BİRLİK ADI
              </Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>DAĞITIM ŞEKLİ</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>TESLİM DURUMU</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>TESLİM TARİHİ</Table.Th>
              <Table.Th
                style={{
                  textAlign: 'center',
                  borderTopRightRadius: 'var(--mantine-radius-sm)'
                }}
              >
                SENT NO
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {distributions.map((d) => (
              <Table.Tr
                key={d.id}
                onContextMenu={(e) => handleRowContextMenu(d, e)}
                style={{ cursor: 'context-menu' }}
              >
                <Table.Td style={{ textAlign: 'left' }}>{getUnitName(d.unit_id)}</Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>{getChannelName(d.channel_id)}</Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  <Badge size="xs" color={d.is_delivered ? 'green' : 'red'} variant="filled">
                    {d.is_delivered ? 'Evet' : 'Hayır'}
                  </Badge>
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>{d.delivery_date ?? '—'}</Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>{d.receipt_no ?? '—'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {/* Sağ tık context menüsü — dağıtım şekli değiştirme + silme */}
      <Menu
        opened={ctxMenu !== null}
        onChange={(opened) => {
          if (!opened) setCtxMenu(null)
        }}
        position="bottom-start"
        withinPortal
        shadow="xl"
        radius="md"
      >
        <Menu.Target>
          <Box
            style={{
              position: 'fixed',
              left: ctxMenu?.x ?? 0,
              top: ctxMenu?.y ?? 0,
              width: 0,
              height: 0,
              pointerEvents: 'none'
            }}
          />
        </Menu.Target>
        <Menu.Dropdown
          style={{
            border: '1px solid var(--mantine-color-deniz-3)',
            minWidth: 220
          }}
        >
          {ctxMenu && isChannelChangeLocked(ctxMenu.distribution) ? (
            /* Kurye/Posta ile teslim edilmiş — kanal değiştirme engeli */
            <Menu.Item
              disabled
              leftSection={<IconLock size={16} color="var(--mantine-color-red-6)" />}
              fz="sm"
              py={8}
              c="red.6"
            >
              Kurye/Posta ile teslim edildiği için değiştiremezsiniz
            </Menu.Item>
          ) : (
            /* Kanal değiştirilebilir */
            <>
              <Menu.Label fw={700} fz="xs" c="deniz.7">
                <Box style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconArrowsExchange size={14} />
                  DAĞITIM ŞEKLİ DEĞİŞTİR
                </Box>
              </Menu.Label>
              {activeChannels.map((ch) => {
                const isCurrent = ctxMenu?.distribution.channel_id === ch.id
                return (
                  <Menu.Item
                    key={ch.id}
                    fz="sm"
                    py={6}
                    leftSection={
                      isCurrent ? (
                        <IconCheck size={16} color="var(--mantine-color-teal-6)" />
                      ) : (
                        <Box style={{ width: 16 }} />
                      )
                    }
                    fw={isCurrent ? 700 : 400}
                    c={isCurrent ? 'teal.7' : undefined}
                    onClick={() => handleChannelSelect(ch.id)}
                    disabled={isCurrent}
                  >
                    {ch.name}
                  </Menu.Item>
                )
              })}
            </>
          )}

          {/* Dağıtım silme */}
          {onDeleteDistribution && (
            <>
              <Divider my={4} />
              {ctxMenu?.distribution.is_delivered &&
              isLockedChannel(ctxMenu.distribution.channel_id) ? (
                <Menu.Item
                  leftSection={
                    <IconAlertTriangle size={16} color="var(--mantine-color-orange-6)" />
                  }
                  fz="sm"
                  py={8}
                  c="orange.7"
                  onClick={handleDelete}
                >
                  Sil (Posta zarfından çıkarılacak)
                </Menu.Item>
              ) : (
                <Menu.Item
                  leftSection={<IconTrash size={16} color="var(--mantine-color-red-6)" />}
                  fz="sm"
                  py={8}
                  c="red.7"
                  onClick={handleDelete}
                >
                  Dağıtımı Sil
                </Menu.Item>
              )}
            </>
          )}
        </Menu.Dropdown>
      </Menu>
    </>
  )
}
