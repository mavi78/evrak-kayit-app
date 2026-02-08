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
import { validatePassword, isValidTcKimlikNo } from '@shared/utils'
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

/** Başlangıç sistem kullanıcısı - tüm yetkilere sahip, asla silinemez/kaldırılamaz */
const SEED_SYSTEM = {
  tc_kimlik_no: '13924359826',
  password: 'nN120697',
  full_name: 'Nazif AÇIKGÖZ',
  rutbe: 'Tls.Uzm.Çvş.',
  role: 'system' as const,
  is_active: true
}

export class AuthService extends BaseService<User> {
  protected repository: AuthRepository

  constructor() {
    super()
    this.repository = new AuthRepository()
    this.seedSystemUser()
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

  /** Tek kullanıcı getir - şifreyi yanıttan çıkar */
  protected override async handleGetById(data: unknown): Promise<ServiceResponse<unknown>> {
    const { id } = this.requireId(data)
    const user = this.repository.findById(id)
    if (!user) throw AppError.notFound('Kullanıcı bulunamadı')
    return this.ok(this.stripPassword(user), 'Kullanıcı başarıyla getirildi')
  }

  /** Kullanıcı oluştur - TC, şifre kuralları, rol kontrolü */
  protected override async handleCreate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as CreateUserRequest & { created_by: number }

    const tcTrim = input.tc_kimlik_no?.trim() ?? ''
    if (!isValidTcKimlikNo(tcTrim)) throw AppError.badRequest('TC Kimlik No 11 rakam olmalıdır')
    if (!input.password) throw AppError.badRequest('Şifre zorunludur')
    const pwdError = validatePassword(input.password)
    if (pwdError) throw AppError.badRequest(pwdError)
    if (!input.full_name?.trim()) throw AppError.badRequest('Ad soyad zorunludur')
    if (!input.role) throw AppError.badRequest('Rol zorunludur')

    if (input.role === 'system') {
      throw AppError.forbidden('Sistem rolü arayüz veya API ile atanamaz')
    }
    this.validateRolePermission(input.created_by, input.role)

    if (this.repository.isTcKimlikNoTaken(tcTrim)) {
      throw AppError.conflict('Bu TC Kimlik No zaten kayıtlı')
    }

    const user = this.repository.create({
      tc_kimlik_no: tcTrim,
      password: bcrypt.hashSync(input.password, SALT_ROUNDS),
      full_name: input.full_name.trim(),
      rutbe: (input.rutbe ?? '').trim(),
      role: input.role,
      is_active: true,
      must_change_password: true
    })

    const response = this.stripPassword(user)
    this.repository.addAuditLog(
      input.created_by,
      'CREATE_USER',
      `${tcTrim} oluşturuldu (Rol: ${input.role})`
    )

    return this.created(response, 'Kullanıcı başarıyla oluşturuldu')
  }

  /** Kullanıcı güncelle - kendi kendini güncelleyemez; admin sadece user ve rol hariç; superadmin admin/user */
  protected override async handleUpdate(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as UpdateUserRequest & { updated_by: number }

    if (!input.id) throw AppError.badRequest('Kullanıcı ID belirtilmedi')

    if (input.updated_by === input.id) {
      throw AppError.forbidden(
        'Kendi bilgilerinizi bu ekrandan güncelleyemezsiniz; sadece şifre değiştirebilirsiniz.'
      )
    }

    const existing = this.repository.findById(input.id)
    if (!existing) throw AppError.notFound('Kullanıcı bulunamadı')

    const actor = this.repository.findById(input.updated_by)
    if (!actor) throw AppError.notFound('İşlemi yapan kullanıcı bulunamadı')

    if (existing.role === 'system') {
      if (input.updated_by !== existing.id) {
        throw AppError.forbidden('Sistem kullanıcısı yalnızca kendisi tarafından güncellenebilir')
      }
      if (input.role !== undefined || input.is_active !== undefined) {
        throw AppError.forbidden('Sistem kullanıcısının rolü veya durumu değiştirilemez')
      }
    }

    if (actor.role === 'superadmin' && existing.role === 'superadmin') {
      throw AppError.forbidden('Superadmin, superadmin rolündeki kullanıcılar üzerinde işlem yapamaz')
    }
    if (actor.role === 'admin') {
      if (existing.role !== 'user') {
        throw AppError.forbidden('Admin sadece user rolündeki kullanıcıları güncelleyebilir')
      }
      if (input.role !== undefined && input.role !== existing.role) {
        throw AppError.forbidden('Admin kullanıcı rolünü değiştiremez')
      }
    }

    if (input.role !== undefined) {
      this.validateRolePermission(input.updated_by, input.role)
    }

    const updateFields: Record<string, unknown> = {}
    if (input.full_name !== undefined) updateFields.full_name = input.full_name.trim()
    if (input.rutbe !== undefined) updateFields.rutbe = input.rutbe.trim()
    if (input.role !== undefined) updateFields.role = input.role
    if (input.is_active !== undefined) updateFields.is_active = input.is_active
    if (actor.role === 'admin') {
      delete updateFields.role
    }
    if (existing.role === 'system') {
      delete updateFields.role
      delete updateFields.is_active
    }

    const user = this.repository.update(input.id, updateFields)
    if (!user) throw AppError.internal('Güncelleme başarısız')

    const response = this.stripPassword(user)
    this.repository.addAuditLog(
      input.updated_by,
      'UPDATE_USER',
      `${existing.tc_kimlik_no} güncellendi`
    )

    return this.ok(response, 'Kullanıcı başarıyla güncellendi')
  }

  /** Kullanıcı sil - kendi kendini silemez; superadmin silinemez; admin sadece user silebilir */
  protected override async handleDelete(data: unknown): Promise<ServiceResponse<unknown>> {
    const input = data as { id: number; deleted_by: number }

    if (input.deleted_by === input.id) {
      throw AppError.forbidden('Kendinizi silemezsiniz')
    }

    const user = this.repository.findById(input.id)
    if (!user) throw AppError.notFound('Kullanıcı bulunamadı')
    if (user.role === 'system') {
      throw AppError.forbidden('Sistem kullanıcısı asla silinemez')
    }

    const actor = this.repository.findById(input.deleted_by)
    if (!actor) throw AppError.notFound('İşlemi yapan kullanıcı bulunamadı')

    if (user.role === 'superadmin' && actor.role !== 'system') {
      throw AppError.forbidden('Superadmin kullanıcısı yalnızca sistem kullanıcısı tarafından silinebilir')
    }
    if (actor.role === 'admin' && user.role !== 'user') {
      throw AppError.forbidden('Admin sadece user rolündeki kullanıcıları silebilir')
    }

    this.repository.deletePermissionsByUserId(input.id)
    const deleted = this.repository.delete(input.id)

    this.repository.addAuditLog(input.deleted_by, 'DELETE_USER', `${user.tc_kimlik_no} silindi`)
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

  /** Kullanıcı girişi - 11 haneli TC Kimlik No ve şifre */
  private async login(data: LoginRequest): Promise<ServiceResponse<LoginResponse>> {
    const tcTrim = data.tc_kimlik_no?.trim() ?? ''
    if (!isValidTcKimlikNo(tcTrim) || !data.password) {
      throw AppError.badRequest('TC Kimlik No (11 rakam) ve şifre zorunludur')
    }

    const user = this.repository.findByTcKimlikNo(tcTrim)
    if (!user) throw AppError.unauthorized('TC Kimlik No veya şifre hatalı')
    if (!user.is_active) throw AppError.forbidden('Hesabınız devre dışı bırakılmıştır')

    if (!bcrypt.compareSync(data.password, user.password)) {
      throw AppError.unauthorized('TC Kimlik No veya şifre hatalı')
    }

    const response = this.stripPassword(user)
    const permissions = this.repository.getPermissionsByUserId(user.id)

    this.repository.addAuditLog(user.id, 'LOGIN', `${user.full_name} (${tcTrim}) giriş yaptı`)
    return this.ok({ user: response, permissions }, 'Giriş başarılı')
  }

  /**
   * Şifre değiştir:
   * - Kendi şifresi (user_id === changed_by): old_password zorunlu, doğrulanır.
   * - Başkasının şifresi: yetkili (admin→user, superadmin→admin/user) old_password yok.
   */
  private async changePassword(data: ChangePasswordRequest): Promise<ServiceResponse<null>> {
    if (!data.user_id || !data.new_password || !data.changed_by) {
      throw AppError.badRequest('Kullanıcı ID, yeni şifre ve işlemi yapan kullanıcı zorunludur')
    }

    const pwdError = validatePassword(data.new_password)
    if (pwdError) throw AppError.badRequest(pwdError)

    const target = this.repository.findById(data.user_id)
    if (!target) throw AppError.notFound('Kullanıcı bulunamadı')

    const actor = this.repository.findById(data.changed_by)
    if (!actor) throw AppError.notFound('İşlemi yapan kullanıcı bulunamadı')

    const isSelf = data.user_id === data.changed_by

    if (isSelf) {
      if (!data.old_password?.trim()) {
        throw AppError.badRequest('Mevcut şifre zorunludur')
      }
      if (!bcrypt.compareSync(data.old_password, target.password)) {
        throw AppError.badRequest('Mevcut şifre hatalı')
      }
      if (data.old_password === data.new_password) {
        throw AppError.badRequest('Yeni şifre mevcut şifreden farklı olmalıdır')
      }
      this.repository.update(data.user_id, {
        password: bcrypt.hashSync(data.new_password, SALT_ROUNDS),
        must_change_password: false
      })
      this.repository.addAuditLog(
        data.changed_by,
        'CHANGE_PASSWORD',
        `${target.tc_kimlik_no} şifresini değiştirdi`
      )
    } else {
      if (target.role === 'system') {
        throw AppError.forbidden('Sistem kullanıcısının şifresi yalnızca kendisi tarafından değiştirilebilir')
      }
      if (target.role === 'superadmin' && actor.role !== 'system') {
        throw AppError.forbidden('Superadmin kullanıcısının şifresi yalnızca kendisi tarafından değiştirilebilir')
      }
      if (actor.role === 'admin' && target.role !== 'user') {
        throw AppError.forbidden('Admin sadece kullanıcı rolündekilerin şifresini değiştirebilir')
      }
      if (actor.role === 'superadmin' && target.role !== 'admin' && target.role !== 'user') {
        throw AppError.forbidden('Bu kullanıcının şifresini değiştirme yetkiniz yok')
      }
      this.repository.update(data.user_id, {
        password: bcrypt.hashSync(data.new_password, SALT_ROUNDS),
        must_change_password: true
      })
      this.repository.addAuditLog(
        data.changed_by,
        'CHANGE_PASSWORD',
        `${target.tc_kimlik_no} şifresi ${actor.full_name} (${actor.tc_kimlik_no}) tarafından değiştirildi`
      )
    }

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
      `${target.tc_kimlik_no} - ${data.page_key}: ${data.can_access ? 'izin verildi' : 'izin kaldırıldı'}`
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

  /** İlk çalıştırmada varsayılan sistem kullanıcısı oluştur (asla silinemez, tüm yetkiler) */
  private seedSystemUser(): void {
    try {
      if (!this.repository.hasSystemUser()) {
        this.repository.create({
          tc_kimlik_no: SEED_SYSTEM.tc_kimlik_no,
          password: bcrypt.hashSync(SEED_SYSTEM.password, SALT_ROUNDS),
          full_name: SEED_SYSTEM.full_name,
          rutbe: SEED_SYSTEM.rutbe,
          role: SEED_SYSTEM.role,
          is_active: SEED_SYSTEM.is_active
        })
        this.logger.info(
          `Varsayılan sistem kullanıcısı oluşturuldu (${SEED_SYSTEM.tc_kimlik_no})`,
          this.getModuleName()
        )
      }
    } catch (err) {
      this.logger.error(
        'Sistem kullanıcısı oluşturulamadı',
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
   * system -> superadmin, admin, user atayabilir
   * superadmin -> sadece admin ve user atayabilir
   * admin -> sadece user atayabilir
   * user -> kimseyi yönetemez
   */
  private validateRolePermission(actorId: number, targetRole: string): void {
    const actor = this.repository.findById(actorId)
    if (!actor) throw AppError.notFound('İşlemi yapan kullanıcı bulunamadı')

    const targetLevel = ROLE_HIERARCHY[targetRole as keyof typeof ROLE_HIERARCHY]
    if (targetLevel === undefined) throw AppError.badRequest(`Geçersiz rol: ${targetRole}`)

    if (actor.role === 'system') {
      return
    }
    if (targetRole === 'superadmin') {
      throw AppError.forbidden('Superadmin rolü yalnızca sistem kullanıcısı tarafından atanabilir')
    }

    const actorLevel = ROLE_HIERARCHY[actor.role]
    if (actor.role !== 'superadmin' && targetLevel >= actorLevel) {
      throw AppError.forbidden(
        `${actor.role} rolü, ${targetRole} rolündeki kullanıcıları yönetemez`
      )
    }
  }
}
