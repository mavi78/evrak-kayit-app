// ============================================================
// Preload tip tanımları - Frontend'in window.api tipini bilmesi için
// ============================================================

export interface PreloadApi {
  invoke: <T>(channel: string, data?: unknown) => Promise<T>
  on: (channel: string, callback: (...args: unknown[]) => void) => void
  off: (channel: string, callback: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    api: PreloadApi
  }
}
