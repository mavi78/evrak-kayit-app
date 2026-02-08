// ============================================================
// AppLayout - Ana uygulama yerleşim düzeni
// Header her zaman; sidebar sadece login dışındaki sayfalarda.
// Sidebar kullanıcı istediğinde ikon seviyesine daraltılabilir.
// ============================================================

import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppShell } from '@mantine/core'
import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'

const SIDEBAR_WIDTH_EXPANDED = 260
const SIDEBAR_WIDTH_COLLAPSED = 72

export function AppLayout(): React.JSX.Element {
  const location = useLocation()
  const showSidebar = location.pathname !== '/login' && location.pathname !== '/'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const navbarWidth = sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED

  return (
    <AppShell
      header={{ height: 40 }}
      navbar={
        showSidebar ? { width: navbarWidth, breakpoint: 'sm' } : { width: 0, breakpoint: 'sm' }
      }
      padding="md"
      styles={{
        root: {
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        },
        main: {
          overflow: 'auto',
          flex: 1,
          minHeight: 0
        }
      }}
    >
      <AppShell.Header>
        <AppHeader />
      </AppShell.Header>

      {showSidebar && (
        <AppShell.Navbar>
          <AppSidebar
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
          />
        </AppShell.Navbar>
      )}

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
