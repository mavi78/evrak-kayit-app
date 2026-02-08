// ============================================================
// Mantine Tema Merkezi - Deniz Kuvvetleri Komutanlığı kurumsal görünüm
// ui-ux-pro-max skill: navy maritime institutional, Professional navy + blue CTA.
// Primary #0F172A / #1E3A8A, CTA #0369A1.
// ============================================================

import { createTheme, type MantineThemeOverride } from '@mantine/core'

/**
 * Deniz Kuvvetleri kurumsal renk paleti: lacivert / deniz mavisi (primary).
 * Skill: navy maritime institutional; 10 ton Mantine uyumlu.
 */
const DENIZ_NAVY = [
  '#e8eef4',
  '#c8d6e8',
  '#a3b8d4',
  '#7896bc',
  '#5478a4',
  '#385d8c',
  '#1e3a8a',
  '#172d6b',
  '#0f2247',
  '#0a1629'
] as const

/**
 * Deniz Kuvvetleri vurgu rengi: deniz mavisi (CTA, linkler).
 * Skill CTA: #0369A1 (maritime).
 */
const DENIZ_ACCENT = [
  '#e6f4fb',
  '#c2e4f4',
  '#9bd2ec',
  '#6fbde2',
  '#4aaad8',
  '#0369a1',
  '#025a8a',
  '#014a73',
  '#013a5c',
  '#012945'
] as const

export const theme: MantineThemeOverride = createTheme({
  /** Birincil renk: Deniz Kuvvetleri laciverti */
  primaryColor: 'deniz',
  primaryShade: { light: 6, dark: 5 },

  /** Kurumsal yazı tipi */
  fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", sans-serif',
  fontFamilyMonospace: '"Cascadia Code", "Fira Code", monospace',

  /** Köşe yuvarlaklığı — kurumsal, hafif */
  defaultRadius: 'sm',

  /** Deniz Kuvvetleri renkleri */
  colors: {
    deniz: DENIZ_NAVY,
    'deniz-accent': DENIZ_ACCENT
  },

  /** Başlık stilleri — net ve okunaklı */
  headings: {
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '28px', lineHeight: '1.3' },
      h2: { fontSize: '24px', lineHeight: '1.35' },
      h3: { fontSize: '20px', lineHeight: '1.4' },
      h4: { fontSize: '16px', lineHeight: '1.45' }
    }
  },

  /** Bileşen özelleştirmeleri */
  components: {
    Button: {
      defaultProps: {
        size: 'sm',
        variant: 'filled',
        color: 'deniz'
      }
    },
    TextInput: {
      defaultProps: {
        size: 'sm'
      }
    },
    PasswordInput: {
      defaultProps: {
        size: 'sm'
      }
    },
    Select: {
      defaultProps: {
        size: 'sm'
      }
    },
    Table: {
      defaultProps: {
        striped: true,
        highlightOnHover: true,
        withTableBorder: true,
        withColumnBorders: true
      }
    },
    Modal: {
      defaultProps: {
        centered: true
      }
    },
    Card: {
      defaultProps: {
        shadow: 'sm',
        radius: 'md',
        withBorder: true
      }
    },
    Notification: {
      defaultProps: {
        radius: 'md'
      }
    },
    Tooltip: {
      defaultProps: {
        withArrow: true,
        arrowSize: 6,
        arrowRadius: 1,
        openDelay: 350,
        closeDelay: 80,
        transitionProps: { transition: 'fade', duration: 150 },
        radius: 'md',
        color: 'dark',
        multiline: true,
        autoContrast: true
      },
      styles: () => ({
        tooltip: {
          fontWeight: 500,
          fontSize: '0.8125rem',
          lineHeight: 1.4,
          padding: '6px 12px',
          maxWidth: 260,
          boxShadow: '0 4px 14px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '6px'
        }
      })
    }
  }
})
