// ============================================================
// AuthService - Kimlik doğrulama, kullanıcı ve izin yönetimi
//
// BaseService'den türetilir:
// - Standart CRUD (get-all, get-by-id, create, update, delete) miras alınır
// - handleGetAll, handleCreate, handleUpdate, handleDelete override edilir
//   (şifre hashleme, rol doğrulama, şifreyi yanıttan çıkarma)
// - Özel handler'lar getCustomHandlers() ile eklenir
// ============================================================

import bcrypt from 'bcryptjs'
import { BaseService } from '@main/core/BaseService'
import { AppError } from '@main/core/AppError'
import { AuthRepository } from './auth.repository'
import { ROLE_HIERARCHY } from '@shared/types'
import type {
  ServiceResponse,
  User,
  UserWithoutPassword,
  LoginRequest,
  LoginResponse,
  CreateUserRequest,
  UpdateUserRequest,
  ChangePasswordRequest,
  SetPermissionRequest,
  PagePermission
} from '@shared/types'
import type { ServiceHandlerMap } from '@main/core/types'

const SALT_ROUNDS = 10

export class AuthService extends BaseService<User> {
  protected repository: AuthRepository

  constructor() {
    super()
    this.repository = new AuthRepository()
    this.seedSuperAdmin()
  }

  getModuleName(): string {
    return 'AuthService'
  }

  getChannelPrefix(): string {
    return 'auth'
  }

  // ================================================================
  // STANDART CRUD OVERRIDE'LARI
  // ================================================================

  /** Kullanıcıları şifre hariç getir */
  protected override async handleGetAll(): Promise<ServiceResponse<unknown>> {
    const users = this.repository.findAllWithoutPassword()
    return this.ok(users, 'Kullanıcılar başarıyla getirildi')
  }

  /** Kullanıcı oluştur - şifre hashle, rol kontrolü yap */
  protected override async handleCreate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as CreateUserRequest & { created_by: number }

    if (!input.username?.trim()) throw AppError.badRequest('Kullanıcı adı zorunludur')
    if (!input.password) throw AppError.badRequest('Şifre zorunludur')
    if (!input.full_name?.trim()) throw AppError.badRequest('Ad soyad zorunludur')
    if (!input.role) throw AppError.badRequest('Rol zorunludur')

    this.validateRolePermission(input.created_by, input.role)

    if (this.repository.isUsernameTaken(input.username.trim())) {
      throw AppError.conflict('Bu kullanıcı adı zaten kullanılıyor')
    }

    const user = this.repository.create({
      username: input.username.trim(),
      password: bcrypt.hashSync(input.password, SALT_ROUNDS),
      full_name: input.full_name.trim(),
      role: input.role,
      is_active: true
    })

    const response = this.stripPassword(user)
    this.repository.addAuditLog(
      input.created_by,
      'CREATE_USER',
      `${input.username} oluşturuldu (Rol: ${input.role})`
    )

    return this.created(response, 'Kullanıcı başarıyla oluşturuldu')
  }

  /** Kullanıcı güncelle - rol kontrolü yap */
  protected override async handleUpdate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as UpdateUserRequest & { updated_by: number }

    if (!input.id) throw AppError.badRequest('Kullanıcı ID belirtilmedi')

    const existing = this.repository.findById(input.id)
    if (!existing) throw AppError.notFound('Kullanıcı bulunamadı')

    if (input.role) {
      this.validateRolePermission(input.updated_by, input.role)
    }

    const updateFields: Record<string, unknown> = {}
    if (input.full_name !== undefined) updateFields.full_name = input.full_name.trim()
    if (input.role !== undefined) updateFields.role = input.role
    if (input.is_active !== undefined) updateFields.is_active = input.is_active

    const user = this.repository.update(input.id, updateFields)
    if (!user) throw AppError.internal('Güncelleme başarısız')

    const response = this.stripPassword(user)
    this.repository.addAuditLog(input.updated_by, 'UPDATE_USER', `${existing.username} güncellendi`)

    return this.ok(response, 'Kullanıcı başarıyla güncellendi')
  }

  /** Kullanıcı sil - superadmin silinemez */
  protected override async handleDelete(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as { id: number; deleted_by: number }

    const user = this.repository.findById(input.id)
    if (!user) throw AppError.notFound('Kullanıcı bulunamadı')
    if (user.role === 'superadmin') throw AppError.forbidden('Superadmin kullanıcısı silinemez')

    this.repository.deletePermissionsByUserId(input.id)
    const deleted = this.repository.delete(input.id)

    this.repository.addAuditLog(input.deleted_by, 'DELETE_USER', `${user.username} silindi`)
    return this.ok(deleted, 'Kullanıcı başarıyla silindi')
  }

  // ================================================================
  // ÖZEL HANDLER'LAR - BaseService'in getCustomHandlers'ı ile eklenir
  // ================================================================

  protected override getCustomHandlers(): ServiceHandlerMap {
    return {
      'auth:login': (data) => this.login(data as LoginRequest),
      'auth:change-password': (data) => this.changePassword(data as ChangePasswordRequest),
      'auth:set-permission': (data) => this.setPermission(data as SetPermissionRequest),
      'auth:get-permissions': (data) => this.getPermissions(data as { user_id: number }),
      'auth:get-current-user': (data) => this.getCurrentUser(data as { user_id: number })
    }
  }

  // ================================================================
  // ÖZEL METODLAR
  // ================================================================

  /** Kullanıcı girişi */
  private async login(data: LoginRequest): Promise<ServiceResponse<LoginResponse>> {
    if (!data.username?.trim() || !data.password) {
      throw AppError.badRequest('Kullanıcı adı ve şifre zorunludur')
    }

    const user = this.repository.findByUsername(data.username.trim())
    if (!user) throw AppError.unauthorized('Kullanıcı adı veya şifre hatalı')
    if (!user.is_active) throw AppError.forbidden('Hesabınız devre dışı bırakılmıştır')

    if (!bcrypt.compareSync(data.password, user.password)) {
      throw AppError.unauthorized('Kullanıcı adı veya şifre hatalı')
    }

    const response = this.stripPassword(user)
    const permissions = this.repository.getPermissionsByUserId(user.id)

    this.repository.addAuditLog(user.id, 'LOGIN', `${user.username} giriş yaptı`)
    return this.ok({ user: response, permissions }, 'Giriş başarılı')
  }

  /** Şifre değiştir */
  private async changePassword(data: ChangePasswordRequest): Promise<ServiceResponse<null>> {
    if (!data.user_id || !data.old_password || !data.new_password) {
      throw AppError.badRequest('Tüm alanlar zorunludur')
    }

    const user = this.repository.findById(data.user_id)
    if (!user) throw AppError.notFound('Kullanıcı bulunamadı')

    if (!bcrypt.compareSync(data.old_password, user.password)) {
      throw AppError.badRequest('Mevcut şifre hatalı')
    }

    this.repository.update(data.user_id, {
      password: bcrypt.hashSync(data.new_password, SALT_ROUNDS)
    })
    this.repository.addAuditLog(
      data.user_id,
      'CHANGE_PASSWORD',
      `${user.username} şifresini değiştirdi`
    )

    return this.ok(null, 'Şifre başarıyla değiştirildi')
  }

  /** Sayfa izni ayarla */
  private async setPermission(
    data: SetPermissionRequest
  ): Promise<ServiceResponse<PagePermission>> {
    if (!data.user_id || !data.page_key) {
      throw AppError.badRequest('Kullanıcı ID ve sayfa anahtarı zorunludur')
    }

    const target = this.repository.findById(data.user_id)
    if (!target) throw AppError.notFound('Hedef kullanıcı bulunamadı')

    const grantor = this.repository.findById(data.granted_by)
    if (!grantor) throw AppError.notFound('Yetki veren kullanıcı bulunamadı')

    if (grantor.role === 'user') {
      throw AppError.forbidden('User rolünde izin verme yetkiniz bulunmuyor')
    }
    if (grantor.role === 'admin' && target.role !== 'user') {
      throw AppError.forbidden('Admin sadece user rolündeki kullanıcılara izin verebilir')
    }

    const permission = this.repository.upsertPermission(
      data.user_id,
      data.page_key,
      data.can_access,
      data.granted_by
    )

    this.repository.addAuditLog(
      data.granted_by,
      'SET_PERMISSION',
      `${target.username} - ${data.page_key}: ${data.can_access ? 'izin verildi' : 'izin kaldırıldı'}`
    )

    return this.ok(permission, 'İzin başarıyla güncellendi')
  }

  /** Kullanıcı izinlerini getir */
  private async getPermissions(data: {
    user_id: number
  }): Promise<ServiceResponse<PagePermission[]>> {
    const permissions = this.repository.getPermissionsByUserId(data.user_id)
    return this.ok(permissions, 'İzinler başarıyla getirildi')
  }

  /** Mevcut kullanıcı bilgilerini getir */
  private async getCurrentUser(data: { user_id: number }): Promise<ServiceResponse<LoginResponse>> {
    const user = this.repository.findById(data.user_id)
    if (!user) throw AppError.notFound('Kullanıcı bulunamadı')

    const response = this.stripPassword(user)
    const permissions = this.repository.getPermissionsByUserId(user.id)

    return this.ok({ user: response, permissions }, 'Kullanıcı bilgileri getirildi')
  }

  // ================================================================
  // YARDIMCILAR
  // ================================================================

  /** İlk çalıştırmada varsayılan superadmin oluştur */
  private seedSuperAdmin(): void {
    try {
      if (!this.repository.hasSuperAdmin()) {
        this.repository.create({
          username: 'superadmin',
          password: bcrypt.hashSync('Admin.123', SALT_ROUNDS),
          full_name: 'Sistem Yöneticisi',
          role: 'superadmin',
          is_active: true
        })
        this.logger.info('Varsayılan superadmin oluşturuldu', this.getModuleName())
      }
    } catch (err) {
      this.logger.error(
        'Superadmin oluşturulamadı',
        err instanceof Error ? err : undefined,
        this.getModuleName()
      )
    }
  }

  /** Kullanıcıdan şifre alanını çıkar */
  private stripPassword(user: User): UserWithoutPassword {
    const withoutPassword = { ...user } as Record<string, unknown>
    delete withoutPassword.password
    return withoutPassword as UserWithoutPassword
  }

  /**
   * Rol yetki kontrolü:
   * superadmin -> herkesi yönetebilir
   * admin -> sadece user yönetebilir
   * user -> kimseyi yönetemez
   */
  private validateRolePermission(actorId: number, targetRole: string): void {
    const actor = this.repository.findById(actorId)
    if (!actor) throw AppError.notFound('İşlemi yapan kullanıcı bulunamadı')

    const actorLevel = ROLE_HIERARCHY[actor.role]
    const targetLevel = ROLE_HIERARCHY[targetRole as keyof typeof ROLE_HIERARCHY]

    if (targetLevel === undefined) throw AppError.badRequest(`Geçersiz rol: ${targetRole}`)

    if (actor.role !== 'superadmin' && targetLevel >= actorLevel) {
      throw AppError.forbidden(
        `${actor.role} rolü, ${targetRole} rolündeki kullanıcıları yönetemez`
      )
    }
  }
}
