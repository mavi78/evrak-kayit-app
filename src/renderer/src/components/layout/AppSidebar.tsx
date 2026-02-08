// ============================================================
// AppSidebar - Sol menü (ui-ux-pro-max skill: Data-Dense, kurumsal)
// Hiyerarşik menü destekler: parent + children (örn. Kurye işlemleri > Teslim edilen).
// Daraltılabilir; tooltip sadece ikon (dar) modunda görünür; açıkken menü etiketleri zaten görünür. Min 44px dokunma alanı.
// ============================================================

import {
  NavLink,
  Stack,
  Box,
  Text,
  Divider,
  Tooltip,
  UnstyledButton,
  Menu,
  useMantineTheme
} from '@mantine/core'
import {
  IconDashboard,
  IconUsers,
  IconFileImport,
  IconFileExport,
  IconArrowsTransferDown,
  IconSettings,
  IconFileText,
  IconChevronLeft,
  IconChevronRight,
  IconInfoCircle,
  IconTruck
} from '@tabler/icons-react'
import { useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@renderer/hooks/useAuth'
import { routes, type RouteConfig } from '@renderer/router/routes'
import type { PageKey } from '@shared/utils'
import type { UserRole } from '@shared/types'

const MIN_TOUCH_TARGET = 44
const HOVER_TRANSITION_MS = 200

/** Sayfa anahtarına göre ikon eşleştirmesi */
const PAGE_ICONS: Record<string, React.ReactNode> = {
  dashboard: <IconDashboard size={20} stroke={1.5} />,
  'user-management': <IconUsers size={20} stroke={1.5} />,
  'incoming-documents': <IconFileImport size={20} stroke={1.5} />,
  'outgoing-documents': <IconFileExport size={20} stroke={1.5} />,
  'transit-documents': <IconArrowsTransferDown size={20} stroke={1.5} />,
  settings: <IconSettings size={20} stroke={1.5} />,
  logs: <IconFileText size={20} stroke={1.5} />,
  'courier-delivered': <IconTruck size={20} stroke={1.5} />,
  'courier-not-delivered': <IconTruck size={20} stroke={1.5} />
}

interface AppSidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

/** Tek bir route için görünürlük (yaprak) */
function isRouteVisible(
  route: RouteConfig,
  hasPageAccess: (key: PageKey) => boolean,
  hasMinimumRole: (role: UserRole) => boolean
): boolean {
  if (!route.showInSidebar) return false
  if (route.minimumRole && !hasMinimumRole(route.minimumRole)) return false
  if (route.requiresPermission && !hasPageAccess(route.pageKey as PageKey)) return false
  return true
}

/** Ağaçtan sadece görünür öğeleri döndürür; grup en az bir görünür alt öğeye sahipse dahil edilir */
function getVisibleMenuItems(
  configs: RouteConfig[],
  hasPageAccess: (key: PageKey) => boolean,
  hasMinimumRole: (role: UserRole) => boolean
): RouteConfig[] {
  const result: RouteConfig[] = []
  for (const r of configs) {
    if (r.children?.length) {
      const visibleChildren = getVisibleMenuItems(r.children, hasPageAccess, hasMinimumRole)
      if (visibleChildren.length > 0) {
        result.push({ ...r, children: visibleChildren })
      }
    } else if (isRouteVisible(r, hasPageAccess, hasMinimumRole)) {
      result.push(r)
    }
  }
  return result
}

export function AppSidebar({ collapsed, onToggleCollapsed }: AppSidebarProps): React.JSX.Element {
  const theme = useMantineTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const { hasPageAccess, hasMinimumRole } = useAuth()

  const visibleRoutes = getVisibleMenuItems(routes, hasPageAccess, hasMinimumRole)

  /** Hiyerarşik menü gruplarının açık/kapalı durumu. Key: parent label; yaprak kapalıyken üst menü aktif gösterilir. */
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const setGroupExpanded = useCallback((label: string, open: boolean) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: open }))
  }, [])

  const renderLeafItem = (route: RouteConfig): React.ReactNode => {
    const isActive = location.pathname === route.path
    const icon = PAGE_ICONS[route.pageKey] ?? <IconFileText size={20} stroke={1.5} />

    if (collapsed) {
      const button = (
        <UnstyledButton
          key={route.path}
          onClick={() => navigate(route.path)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: MIN_TOUCH_TARGET,
            borderRadius: 'var(--mantine-radius-sm)',
            background: isActive ? theme.colors.deniz[1] : 'transparent',
            color: isActive ? theme.colors.deniz[8] : theme.colors.dark[2],
            transition: `background-color ${HOVER_TRANSITION_MS}ms ease, color ${HOVER_TRANSITION_MS}ms ease`,
            cursor: 'pointer'
          }}
          aria-label={`${route.label} sayfasına git`}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = theme.colors.gray[1]
              e.currentTarget.style.color = theme.colors.dark[6]
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = theme.colors.dark[2]
            }
          }}
        >
          {icon}
        </UnstyledButton>
      )
      return (
        <Tooltip key={route.path} label={route.label} position="right">
          {button}
        </Tooltip>
      )
    }

    return (
      <NavLink
        key={route.path}
        label={route.label}
        leftSection={icon}
        active={isActive}
        onClick={() => navigate(route.path)}
        variant="filled"
        color="deniz"
        style={{
          borderRadius: 'var(--mantine-radius-sm)',
          minHeight: MIN_TOUCH_TARGET,
          transition: `background-color ${HOVER_TRANSITION_MS}ms ease`
        }}
        aria-label={`${route.label} sayfasına git`}
      />
    )
  }

  const renderMenuItem = (route: RouteConfig): React.ReactNode => {
    if (route.children?.length) {
      const parentIcon = PAGE_ICONS[route.pageKey] ?? <IconTruck size={20} stroke={1.5} />
      const isChildActive = route.children.some((c) => location.pathname === c.path)
      const isGroupOpen = expandedGroups[route.label] ?? isChildActive
      const isParentActive = isChildActive && !isGroupOpen

      if (collapsed) {
        return (
          <Menu
            key={route.label}
            position="right-start"
            offset={4}
            shadow="md"
            withinPortal
          >
            <Menu.Target>
              <Tooltip label={route.label} position="right">
                <UnstyledButton
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    minHeight: MIN_TOUCH_TARGET,
                    borderRadius: 'var(--mantine-radius-sm)',
                    background: isChildActive ? theme.colors.deniz[1] : 'transparent',
                    color: isChildActive ? theme.colors.deniz[8] : theme.colors.dark[2],
                    transition: `background-color ${HOVER_TRANSITION_MS}ms ease, color ${HOVER_TRANSITION_MS}ms ease`,
                    cursor: 'pointer'
                  }}
                  aria-label={route.label}
                  onMouseEnter={(e) => {
                    if (!isChildActive) {
                      e.currentTarget.style.backgroundColor = theme.colors.gray[1]
                      e.currentTarget.style.color = theme.colors.dark[6]
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isChildActive) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = theme.colors.dark[2]
                    }
                  }}
                >
                  {parentIcon}
                </UnstyledButton>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              {route.children.map((child) => (
                <Menu.Item
                  key={child.path}
                  onClick={() => navigate(child.path)}
                  style={{
                    fontWeight: location.pathname === child.path ? 600 : 400
                  }}
                >
                  {child.label}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        )
      }

      return (
        <NavLink
          key={route.label}
          label={route.label}
          leftSection={parentIcon}
          active={isParentActive}
          opened={isGroupOpen}
          onChange={(open) => setGroupExpanded(route.label, open)}
          variant="filled"
          color="deniz"
          style={{
            borderRadius: 'var(--mantine-radius-sm)',
            minHeight: MIN_TOUCH_TARGET,
            transition: `background-color ${HOVER_TRANSITION_MS}ms ease`
          }}
        >
          {route.children.map((child) => (
            <NavLink
              key={child.path}
              label={child.label}
              active={location.pathname === child.path}
              onClick={() => navigate(child.path)}
              variant="filled"
              color="deniz"
              style={{
                borderRadius: 'var(--mantine-radius-sm)',
                minHeight: MIN_TOUCH_TARGET,
                transition: `background-color ${HOVER_TRANSITION_MS}ms ease`
              }}
              pl="xl"
            />
          ))}
        </NavLink>
      )
    }

    return renderLeafItem(route)
  }

  return (
    <Box
      py="md"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: theme.colors.gray[0],
        borderRight: `1px solid ${theme.colors.gray[2]}`
      }}
    >
      {/* Başlık + daralt / genişlet — tooltip her iki modda (a11y) */}
      <Box
        px={collapsed ? 'xs' : 'md'}
        mb="sm"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: MIN_TOUCH_TARGET
        }}
      >
        {!collapsed && (
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts={0.5}>
            Menü
          </Text>
        )}
        <Tooltip label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'} position="right">
          <UnstyledButton
            onClick={onToggleCollapsed}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: MIN_TOUCH_TARGET,
              height: MIN_TOUCH_TARGET - 8,
              borderRadius: 'var(--mantine-radius-sm)',
              color: theme.colors.dark[2],
              transition: `background-color ${HOVER_TRANSITION_MS}ms ease, color ${HOVER_TRANSITION_MS}ms ease`,
              cursor: 'pointer'
            }}
            aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.gray[2]
              e.currentTarget.style.color = theme.colors.dark[6]
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = theme.colors.dark[2]
            }}
          >
            {collapsed ? (
              <IconChevronRight size={18} stroke={2} />
            ) : (
              <IconChevronLeft size={18} stroke={2} />
            )}
          </UnstyledButton>
        </Tooltip>
      </Box>

      <Divider color="gray.2" mb="sm" />

      <Stack gap={2} px="xs" style={{ flex: 1 }}>
        {visibleRoutes.map(renderMenuItem)}
      </Stack>

      <Box px={collapsed ? 'xs' : 'md'} mt="auto" pt="sm">
        <Divider color="gray.2" mb="sm" />
        {collapsed ? (
          <Tooltip label="Sürüm: v1.0.0" position="right">
            <UnstyledButton
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                minHeight: MIN_TOUCH_TARGET,
                borderRadius: 'var(--mantine-radius-sm)',
                color: theme.colors.dark[2],
                transition: `background-color ${HOVER_TRANSITION_MS}ms ease`,
                cursor: 'default'
              }}
              aria-label="Sürüm v1.0.0"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.gray[1]
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <IconInfoCircle size={20} stroke={1.5} />
            </UnstyledButton>
          </Tooltip>
        ) : (
          <Text size="xs" c="dimmed" ta="center">
            v1.0.0
          </Text>
        )}
      </Box>
    </Box>
  )
}
