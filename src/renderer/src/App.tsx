// ============================================================
// App - Uygulama kök bileşeni
// Splash ayrı pencerede açıldığı için burada yalnızca ana uygulama gösterilir.
// ============================================================

import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { HashRouter } from 'react-router-dom'
import { theme } from '@renderer/theme'
import { AuthProvider } from '@renderer/context'
import { AppRouter } from '@renderer/router'

/**
 * HashRouter kullanılma sebebi: Electron file:// protokolü
 * ile BrowserRouter düzgün çalışmaz. HashRouter bu sorunu çözer.
 */
function App(): React.JSX.Element {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <MantineProvider theme={theme} defaultColorScheme="light">
        <Notifications position="top-right" />
        <HashRouter>
          <AuthProvider>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <AppRouter />
            </div>
          </AuthProvider>
        </HashRouter>
      </MantineProvider>
    </div>
  )
}

export default App
