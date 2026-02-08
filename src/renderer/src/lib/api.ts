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
  DeleteUserRequest
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
    invoke<LoginResponse>('auth:get-current-user', { user_id: userId })
}
