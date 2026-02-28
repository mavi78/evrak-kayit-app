// ============================================================
// TransitDocumentService - Transit evrak iş mantığı
// ============================================================

import { IncomingDocumentService } from '@main/modules/incoming-document/incoming-document.service'
import { TransitDocumentRepository } from './transit-document.repository'
import type { DocumentScope } from '@shared/types'

export class TransitDocumentService extends IncomingDocumentService {
  constructor() {
    super()
    this.repository = new TransitDocumentRepository()
  }

  override getModuleName(): string {
    return 'TransitDocumentService'
  }

  override getChannelPrefix(): string {
    return 'transit-document'
  }

  protected override getDocumentScope(): DocumentScope {
    return 'TRANSIT'
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
