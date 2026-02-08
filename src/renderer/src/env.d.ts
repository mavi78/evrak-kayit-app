/// <reference types="vite/client" />

import type { PreloadApi } from '../../../preload/index.d'

declare global {
  interface Window {
    api: PreloadApi
  }
}
