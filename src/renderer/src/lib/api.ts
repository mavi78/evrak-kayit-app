// ============================================================
// Frontend API Katmanı - Backend ile tipli iletişim
// Tüm IPC çağrıları bu katmandan yapılır.
// Hata yakalama dahil - IPC bağlantı hataları bile ServiceResponse döner.
// ============================================================

import type {
  ServiceResponse,
  LoginRequest,
  LoginResponse,
  UserWithoutPassword,
  CreateUserRequest,
  UpdateUserRequest,
  ChangePasswordRequest,
  SetPermissionRequest,
  PagePermission,
  RoleVisibilityDefault,
  DeleteUserRequest,
  Unit,
  CreateUnitRequest,
  UpdateUnitRequest,
  Classification,
  CreateClassificationRequest,
  UpdateClassificationRequest,
  Channel,
  CreateChannelRequest,
  UpdateChannelRequest,
  Folder,
  CreateFolderRequest,
  UpdateFolderRequest,
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  UpdateSortOrderRequest,
  UpdateUnitHierarchyRequest,
  UpdateUnitSortOrderRequest,
  IncomingDocument,
  DocumentDistribution,
  CreateIncomingDocumentRequest,
  UpdateIncomingDocumentRequest,
  SearchIncomingDocumentsRequest,
  PaginatedIncomingDocumentsResponse,
  NextRecordInfoResponse,
  CreateDistributionRequest,
  UpdateDistributionRequest,
  DeliverDistributionRequest,
  CourierPendingDistribution,
  BulkDeliverRequest,
  BulkDeliverResponse,
  DeliveredReceiptInfo,
  CourierDeliveredListRequest,
  DocumentScope,
  AppSetting,
  AppSettingKey,
  SetSettingRequest,
  PostalStamp,
  CreatePostalStampRequest,
  UpdatePostalStampRequest,
  PostalEnvelope,
  PostalEnvelopeDetail,
  PendingPostalDistribution,
  CreatePostalEnvelopeRequest,
  UpdatePostalEnvelopeRequest
} from '@shared/types'

/**
 * Generic IPC invoke - tüm API çağrıları bunu kullanır.
 * IPC bağlantı hatası bile yakalanır, ServiceResponse formatında döner.
 */
async function invoke<T>(channel: string, data?: unknown): Promise<ServiceResponse<T>> {
  try {
    return await window.api.invoke<ServiceResponse<T>>(channel, data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bağlantı hatası oluştu'
    return {
      success: false,
      data: null as unknown as T,
      message,
      statusCode: 500
    }
  }
}

// ============================================================
// AUTH API - Standart CRUD + Özel endpointler
// Kanal adları BaseService'deki pattern ile eşleşir:
//   Standart: {prefix}:get-all, {prefix}:get-by-id, {prefix}:create, {prefix}:update, {prefix}:delete
//   Özel: auth:login, auth:change-password, auth:set-permission, ...
// ============================================================
export const authApi = {
  // Standart CRUD
  getAll: (): Promise<ServiceResponse<UserWithoutPassword[]>> =>
    invoke<UserWithoutPassword[]>('auth:get-all'),

  getById: (id: number): Promise<ServiceResponse<UserWithoutPassword>> =>
    invoke<UserWithoutPassword>('auth:get-by-id', { id }),

  create: (
    data: CreateUserRequest & { created_by: number }
  ): Promise<ServiceResponse<UserWithoutPassword>> =>
    invoke<UserWithoutPassword>('auth:create', data),

  update: (
    data: UpdateUserRequest & { updated_by: number }
  ): Promise<ServiceResponse<UserWithoutPassword>> =>
    invoke<UserWithoutPassword>('auth:update', data),

  delete: (data: DeleteUserRequest & { deleted_by: number }): Promise<ServiceResponse<boolean>> =>
    invoke<boolean>('auth:delete', data),

  // Özel endpointler
  login: (data: LoginRequest): Promise<ServiceResponse<LoginResponse>> =>
    invoke<LoginResponse>('auth:login', data),

  changePassword: (data: ChangePasswordRequest): Promise<ServiceResponse<null>> =>
    invoke<null>('auth:change-password', data),

  setPermission: (data: SetPermissionRequest): Promise<ServiceResponse<PagePermission>> =>
    invoke<PagePermission>('auth:set-permission', data),

  getPermissions: (userId: number): Promise<ServiceResponse<PagePermission[]>> =>
    invoke<PagePermission[]>('auth:get-permissions', { user_id: userId }),

  getCurrentUser: (userId: number): Promise<ServiceResponse<LoginResponse>> =>
    invoke<LoginResponse>('auth:get-current-user', { user_id: userId }),

  getRolePageDefaults: (
    role: 'superadmin' | 'admin' | 'user'
  ): Promise<ServiceResponse<string[]>> =>
    invoke<string[]>('auth:get-role-page-defaults', { role }),

  setRolePageDefaults: (data: {
    role: 'superadmin' | 'admin' | 'user'
    page_keys: string[]
    set_by: number
  }): Promise<ServiceResponse<null>> => invoke<null>('auth:set-role-page-defaults', data),

  getAssignablePages: (targetUserId: number, actorId: number): Promise<ServiceResponse<string[]>> =>
    invoke<string[]>('auth:get-assignable-pages', {
      target_user_id: targetUserId,
      actor_id: actorId
    }),

  getAssignablePagesForRole: (
    actorId: number,
    targetRole: 'superadmin' | 'admin' | 'user'
  ): Promise<ServiceResponse<string[]>> =>
    invoke<string[]>('auth:get-assignable-pages-for-role', {
      actor_id: actorId,
      target_role: targetRole
    }),

  getRoleVisibilityDefaults: (
    role: 'superadmin' | 'admin' | 'user'
  ): Promise<ServiceResponse<RoleVisibilityDefault[]>> =>
    invoke<RoleVisibilityDefault[]>('auth:get-role-visibility-defaults', { role }),

  setRoleVisibilityDefaults: (data: {
    target_role: 'superadmin' | 'admin' | 'user'
    defaults: RoleVisibilityDefault[]
    actor_id: number
  }): Promise<ServiceResponse<null>> => invoke<null>('auth:set-role-visibility-defaults', data)
}

// ============================================================
// AYARLAR API — Birlik, Gizlilik derecesi, Kanal, Klasör, Kategori
// ============================================================

export const unitApi = {
  getAll: (): Promise<ServiceResponse<Unit[]>> => invoke<Unit[]>('unit:get-all'),
  getById: (id: number): Promise<ServiceResponse<Unit>> => invoke<Unit>('unit:get-by-id', { id }),
  create: (data: CreateUnitRequest): Promise<ServiceResponse<Unit>> =>
    invoke<Unit>('unit:create', data),
  update: (data: UpdateUnitRequest): Promise<ServiceResponse<Unit>> =>
    invoke<Unit>('unit:update', data),
  delete: (id: number): Promise<ServiceResponse<boolean>> => invoke<boolean>('unit:delete', { id }),
  updateHierarchy: (data: UpdateUnitHierarchyRequest): Promise<ServiceResponse<Unit>> =>
    invoke<Unit>('unit:update-hierarchy', data),
  updateSortOrder: (data: UpdateUnitSortOrderRequest): Promise<ServiceResponse<boolean>> =>
    invoke<boolean>('unit:update-sort-order', data)
}

export const classificationApi = {
  getAll: (): Promise<ServiceResponse<Classification[]>> =>
    invoke<Classification[]>('classification:get-all'),
  getById: (id: number): Promise<ServiceResponse<Classification>> =>
    invoke<Classification>('classification:get-by-id', { id }),
  create: (data: CreateClassificationRequest): Promise<ServiceResponse<Classification>> =>
    invoke<Classification>('classification:create', data),
  update: (data: UpdateClassificationRequest): Promise<ServiceResponse<Classification>> =>
    invoke<Classification>('classification:update', data),
  delete: (id: number): Promise<ServiceResponse<boolean>> =>
    invoke<boolean>('classification:delete', { id }),
  updateSortOrder: (data: UpdateSortOrderRequest): Promise<ServiceResponse<boolean>> =>
    invoke<boolean>('classification:update-sort-order', data)
}

export const channelApi = {
  getAll: (): Promise<ServiceResponse<Channel[]>> => invoke<Channel[]>('channel:get-all'),
  getById: (id: number): Promise<ServiceResponse<Channel>> =>
    invoke<Channel>('channel:get-by-id', { id }),
  create: (data: CreateChannelRequest): Promise<ServiceResponse<Channel>> =>
    invoke<Channel>('channel:create', data),
  update: (data: UpdateChannelRequest): Promise<ServiceResponse<Channel>> =>
    invoke<Channel>('channel:update', data),
  delete: (id: number): Promise<ServiceResponse<boolean>> =>
    invoke<boolean>('channel:delete', { id }),
  updateSortOrder: (data: UpdateSortOrderRequest): Promise<ServiceResponse<boolean>> =>
    invoke<boolean>('channel:update-sort-order', data)
}

export const folderApi = {
  getAll: (): Promise<ServiceResponse<Folder[]>> => invoke<Folder[]>('folder:get-all'),
  getById: (id: number): Promise<ServiceResponse<Folder>> =>
    invoke<Folder>('folder:get-by-id', { id }),
  create: (data: CreateFolderRequest): Promise<ServiceResponse<Folder>> =>
    invoke<Folder>('folder:create', data),
  update: (data: UpdateFolderRequest): Promise<ServiceResponse<Folder>> =>
    invoke<Folder>('folder:update', data),
  delete: (id: number): Promise<ServiceResponse<boolean>> =>
    invoke<boolean>('folder:delete', { id }),
  updateSortOrder: (data: UpdateSortOrderRequest): Promise<ServiceResponse<boolean>> =>
    invoke<boolean>('folder:update-sort-order', data)
}

export const categoryApi = {
  getAll: (): Promise<ServiceResponse<Category[]>> => invoke<Category[]>('category:get-all'),
  getById: (id: number): Promise<ServiceResponse<Category>> =>
    invoke<Category>('category:get-by-id', { id }),
  create: (data: CreateCategoryRequest): Promise<ServiceResponse<Category>> =>
    invoke<Category>('category:create', data),
  update: (data: UpdateCategoryRequest): Promise<ServiceResponse<Category>> =>
    invoke<Category>('category:update', data),
  delete: (id: number): Promise<ServiceResponse<boolean>> =>
    invoke<boolean>('category:delete', { id }),
  updateSortOrder: (data: UpdateSortOrderRequest): Promise<ServiceResponse<boolean>> =>
    invoke<boolean>('category:update-sort-order', data)
}

// ============================================================
// GELEN EVRAK API
// ============================================================

export const incomingDocumentApi = {
  list: (
    filters: SearchIncomingDocumentsRequest
  ): Promise<ServiceResponse<PaginatedIncomingDocumentsResponse>> =>
    invoke<PaginatedIncomingDocumentsResponse>('incoming-document:list', filters),
  nextRecordInfo: (): Promise<ServiceResponse<NextRecordInfoResponse>> =>
    invoke<NextRecordInfoResponse>('incoming-document:next-record-info'),
  getById: (id: number): Promise<ServiceResponse<IncomingDocument>> =>
    invoke<IncomingDocument>('incoming-document:get-by-id', { id }),
  create: (data: CreateIncomingDocumentRequest): Promise<ServiceResponse<IncomingDocument>> =>
    invoke<IncomingDocument>('incoming-document:create', data),
  update: (data: UpdateIncomingDocumentRequest): Promise<ServiceResponse<IncomingDocument>> =>
    invoke<IncomingDocument>('incoming-document:update', data),
  delete: (id: number): Promise<ServiceResponse<boolean>> =>
    invoke<boolean>('incoming-document:delete', { id }),
  getDistributions: (
    documentId: number,
    documentScope: DocumentScope
  ): Promise<ServiceResponse<DocumentDistribution[]>> =>
    invoke<DocumentDistribution[]>('incoming-document:get-distributions', {
      document_id: documentId,
      document_scope: documentScope
    }),
  addDistribution: (
    data: CreateDistributionRequest
  ): Promise<ServiceResponse<DocumentDistribution>> =>
    invoke<DocumentDistribution>('incoming-document:add-distribution', data),
  updateDistribution: (
    data: UpdateDistributionRequest
  ): Promise<ServiceResponse<DocumentDistribution | null>> =>
    invoke<DocumentDistribution | null>('incoming-document:update-distribution', data),
  deleteDistribution: (
    id: number,
    forcePostalDelete?: boolean
  ): Promise<ServiceResponse<boolean>> =>
    invoke<boolean>('incoming-document:delete-distribution', {
      id,
      force_postal_delete: forcePostalDelete
    }),
  deliverDistribution: (
    data: DeliverDistributionRequest
  ): Promise<ServiceResponse<DocumentDistribution | null>> =>
    invoke<DocumentDistribution | null>('incoming-document:deliver-distribution', data),

  // Kurye İşlemleri
  courierPending: (unitIds: number[]): Promise<ServiceResponse<CourierPendingDistribution[]>> =>
    invoke<CourierPendingDistribution[]>('incoming-document:courier-pending', {
      unit_ids: unitIds
    }),

  courierBulkDeliver: (data: BulkDeliverRequest): Promise<ServiceResponse<BulkDeliverResponse>> =>
    invoke<BulkDeliverResponse>('incoming-document:courier-bulk-deliver', data),

  courierDeliveredList: (
    data: CourierDeliveredListRequest
  ): Promise<ServiceResponse<DeliveredReceiptInfo[]>> =>
    invoke<DeliveredReceiptInfo[]>('incoming-document:courier-delivered-list', data)
}

// ============================================================
// UYGULAMA AYARLARI API
// ============================================================

export const appSettingsApi = {
  get: (key: AppSettingKey): Promise<ServiceResponse<AppSetting | null>> =>
    invoke<AppSetting | null>('app-settings:get', { key }),

  set: (data: SetSettingRequest): Promise<ServiceResponse<AppSetting>> =>
    invoke<AppSetting>('app-settings:set', data),

  getOrganization: (): Promise<ServiceResponse<AppSetting | null>> =>
    invoke<AppSetting | null>('app-settings:get-organization')
}

// ============================================================
// POSTA PULU API
// ============================================================

export const postalStampApi = {
  getAll: (): Promise<ServiceResponse<PostalStamp[]>> =>
    invoke<PostalStamp[]>('postal-stamp:get-all'),
  getById: (id: number): Promise<ServiceResponse<PostalStamp>> =>
    invoke<PostalStamp>('postal-stamp:get-by-id', { id }),
  create: (data: CreatePostalStampRequest): Promise<ServiceResponse<PostalStamp>> =>
    invoke<PostalStamp>('postal-stamp:create', data),
  update: (data: UpdatePostalStampRequest): Promise<ServiceResponse<PostalStamp>> =>
    invoke<PostalStamp>('postal-stamp:update', data),
  delete: (id: number): Promise<ServiceResponse<boolean>> =>
    invoke<boolean>('postal-stamp:delete', { id })
}

// ============================================================
// POSTA ZARFI API
// ============================================================

export const postalEnvelopeApi = {
  /** Bekleyenler havuzu — posta kanalı + zarflanmamış dağıtımlar */
  getPending: (): Promise<ServiceResponse<PendingPostalDistribution[]>> =>
    invoke<PendingPostalDistribution[]>('postal-envelope:get-pending'),

  /** Zarf oluşturma (evraklar + pullar) */
  createEnvelope: (data: CreatePostalEnvelopeRequest): Promise<ServiceResponse<PostalEnvelope>> =>
    invoke<PostalEnvelope>('postal-envelope:create-envelope', data),

  /** Tek zarf detayı */
  getEnvelopeDetail: (id: number): Promise<ServiceResponse<PostalEnvelopeDetail>> =>
    invoke<PostalEnvelopeDetail>('postal-envelope:get-envelope-detail', { id }),

  /** Tüm geçmiş zarflar */
  getAllEnvelopes: (): Promise<ServiceResponse<PostalEnvelopeDetail[]>> =>
    invoke<PostalEnvelopeDetail[]>('postal-envelope:get-all-envelopes'),

  /** Zarf güncelleme (alıcı adı + RR Kod + pullar) */
  updateEnvelope: (data: UpdatePostalEnvelopeRequest): Promise<ServiceResponse<PostalEnvelope>> =>
    invoke<PostalEnvelope>('postal-envelope:update-envelope', data)
}
