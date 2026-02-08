// ============================================================
// Backend çekirdek tip tanımları
// ============================================================

import type { ServiceResponse } from '@shared/types'

/** Servis handler - data alır, ServiceResponse döner (event gerekmez) */
export type ServiceHandler = (data: unknown) => Promise<ServiceResponse<unknown>>

/** IPC handler - Electron IPC formatı (event + data) */
export type IpcHandler = (
  event: Electron.IpcMainInvokeEvent,
  data: unknown
) => Promise<ServiceResponse<unknown>>

/** Servis handler haritası: kanal adı -> servis handler */
export interface ServiceHandlerMap {
  [channel: string]: ServiceHandler
}

/** IPC handler haritası: kanal adı -> IPC handler */
export interface IpcHandlerMap {
  [channel: string]: IpcHandler
}

/** IPC'ye kayıt edilebilir servis arayüzü */
export interface IpcRegistrable {
  getModuleName(): string
  getHandlers(): IpcHandlerMap
}
