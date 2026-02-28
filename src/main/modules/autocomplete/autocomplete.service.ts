import { Logger } from '@main/core/Logger'
import type { IpcRegistrable, IpcHandlerMap } from '@main/core/types'
import { AutocompleteRepository } from './autocomplete.repository'
import type { ServiceResponse } from '@shared/types'
import { STATUS_CODES } from '@shared/utils/constants'

export class AutocompleteService implements IpcRegistrable {
  private repository: AutocompleteRepository
  private logger: Logger

  constructor() {
    this.repository = new AutocompleteRepository()
    this.logger = Logger.getInstance()
  }

  getModuleName(): string {
    return 'AutocompleteService'
  }

  getHandlers(): IpcHandlerMap {
    return {
      'autocomplete:search': async (
        _event: Electron.IpcMainInvokeEvent,
        data: unknown
      ): Promise<ServiceResponse<string[]>> => {
        try {
          const { field, query } = data as { field: string; query: string }
          if (!query || query.trim().length < 3) {
            return { success: true, data: [], message: '', statusCode: STATUS_CODES.OK }
          }
          const results = this.repository.search(field, query)
          return { success: true, data: results, message: '', statusCode: STATUS_CODES.OK }
        } catch (err: unknown) {
          this.logger.error(
            'Arama hatası',
            err instanceof Error ? err : new Error(String(err)),
            this.getModuleName()
          )
          return {
            success: false,
            data: [],
            message: 'Hata oluştu',
            statusCode: STATUS_CODES.INTERNAL_ERROR
          }
        }
      },

      'autocomplete:add': async (
        _event: Electron.IpcMainInvokeEvent,
        data: unknown
      ): Promise<ServiceResponse<boolean>> => {
        try {
          const { field, value } = data as { field: string; value: string }
          const result = this.repository.addSuggestion(field, value)
          return { success: true, data: result, message: '', statusCode: STATUS_CODES.OK }
        } catch (err: unknown) {
          this.logger.error(
            'Ekleme hatası',
            err instanceof Error ? err : new Error(String(err)),
            this.getModuleName()
          )
          return {
            success: false,
            data: false,
            message: 'Hata oluştu',
            statusCode: STATUS_CODES.INTERNAL_ERROR
          }
        }
      }
    }
  }
}
