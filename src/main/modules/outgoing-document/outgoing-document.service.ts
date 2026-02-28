// ============================================================
// OutgoingDocumentService - Giden evrak iş mantığı
// ============================================================

import { IncomingDocumentService } from '@main/modules/incoming-document/incoming-document.service'
import { OutgoingDocumentRepository } from './outgoing-document.repository'
import type { DocumentScope } from '@shared/types'

export class OutgoingDocumentService extends IncomingDocumentService {
  constructor() {
    super()
    this.repository = new OutgoingDocumentRepository()
  }

  override getModuleName(): string {
    return 'OutgoingDocumentService'
  }

  override getChannelPrefix(): string {
    return 'outgoing-document'
  }

  protected override getDocumentScope(): DocumentScope {
    return 'OUTGOING'
  }
  protected override getCustomHandlers(): import('../../core/types').ServiceHandlerMap {
    const prefix = this.getChannelPrefix()
    return {
      [`${prefix}:list`]: (data) =>
        this.handleList(data as import('@shared/types').SearchIncomingDocumentsRequest),
      [`${prefix}:next-record-info`]: () => this.handleNextRecordInfo(),
      [`${prefix}:get-distributions`]: (data) => this.handleGetDistributions(data),
      [`${prefix}:add-distribution`]: (data) =>
        this.handleAddDistribution(data as import('@shared/types').CreateDistributionRequest),
      [`${prefix}:update-distribution`]: (data) =>
        this.handleUpdateDistribution(data as import('@shared/types').UpdateDistributionRequest),
      [`${prefix}:delete-distribution`]: (data) => this.handleDeleteDistribution(data),
      [`${prefix}:deliver-distribution`]: (data) =>
        this.handleDeliverDistribution(data as import('@shared/types').DeliverDistributionRequest),
      [`${prefix}:courier-pending`]: (data) => this.handleCourierPending(data),
      [`${prefix}:courier-bulk-deliver`]: (data) =>
        this.handleCourierBulkDeliver(data as import('@shared/types').BulkDeliverRequest),
      [`${prefix}:courier-delivered-list`]: (data) =>
        this.handleCourierDeliveredList(data as import('@shared/types').CourierDeliveredListRequest)
    }
  }
}
