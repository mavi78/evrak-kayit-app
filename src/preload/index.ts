// ============================================================
// Preload - Bir kez yazılır, bir daha dokunulmaz!
// Generic invoke pattern: Yeni modül eklense bile bu dosya değişmez.
// Renderer (frontend) ile Main (backend) arasındaki tek köprü.
// ============================================================

import { contextBridge, ipcRenderer } from 'electron'

/** Frontend'in kullanacağı API arayüzü */
const api = {
  /**
   * IPC üzerinden backend'e istek gönderir
   * @param channel - IPC kanal adı (örn: 'auth:login')
   * @param data - Gönderilecek veri
   * @returns Backend'den dönen ServiceResponse
   */
  invoke: <T>(channel: string, data?: unknown): Promise<T> => {
    return ipcRenderer.invoke(channel, data)
  },

  /**
   * Backend'den gelen olayları dinler
   * @param channel - Dinlenecek kanal
   * @param callback - Olay tetiklendiğinde çalışacak fonksiyon
   */
  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  },

  /**
   * Backend olayı dinlemeyi bırakır
   * @param channel - Dinlemeyi bırakılacak kanal
   * @param callback - Kaldırılacak listener
   */
  off: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.removeListener(channel, callback)
  }
}

// Context Bridge ile güvenli bir şekilde renderer'a aç
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('API expose edilemedi:', error)
  }
} else {
  // Context isolation kapalıysa direkt window'a ekle (fallback)
  ;(window as unknown as Record<string, unknown>).api = api
}
