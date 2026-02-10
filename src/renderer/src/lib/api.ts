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
  UpdateUnitSortOrderRequest
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
