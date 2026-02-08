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
import { validatePassword, isValidTcKimlikNo, PAGES_REQUIRING_PERMISSION } from '@shared/utils'
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
  GetRolePageDefaultsRequest,
  SetRolePageDefaultsRequest,
  GetAssignablePagesRequest,
  GetAssignablePagesForRoleRequest,
  GetRoleVisibilityDefaultsRequest,
  SetRoleVisibilityDefaultsRequest,
  RoleVisibilityDefault,
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
      'auth:get-current-user': (data) => this.getCurrentUser(data as { user_id: number }),
      'auth:get-role-page-defaults': (data) =>
        this.getRolePageDefaults(data as GetRolePageDefaultsRequest),
      'auth:set-role-page-defaults': (data) =>
        this.setRolePageDefaults(data as SetRolePageDefaultsRequest),
      'auth:get-assignable-pages': (data) =>
        this.getAssignablePages(data as GetAssignablePagesRequest),
      'auth:get-assignable-pages-for-role': (data) =>
        this.getAssignablePagesForRole(data as GetAssignablePagesForRoleRequest),
      'auth:get-role-visibility-defaults': (data) =>
        this.getRoleVisibilityDefaults(data as GetRoleVisibilityDefaultsRequest),
      'auth:set-role-visibility-defaults': (data) =>
        this.setRoleVisibilityDefaults(data as SetRoleVisibilityDefaultsRequest)
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
    const permissionKeysSet = new Set(PAGES_REQUIRING_PERMISSION as readonly string[])
    const roleVisibilityDefaults = this.buildRoleVisibilityDefaultsForUser(user.role, permissionKeysSet)

    this.repository.addAuditLog(user.id, 'LOGIN', `${user.full_name} (${tcTrim}) giriş yaptı`)
    return this.ok(
      { user: response, permissions: [], role_visibility_defaults: roleVisibilityDefaults },
      'Giriş başarılı'
    )
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

  /** Sayfa izni ayarla — hiyerarşi: system tüm sayfalar; superadmin role defaults; admin sadece superadmin'ın verdiği sayfalar */
  private async setPermission(
    data: SetPermissionRequest
  ): Promise<ServiceResponse<PagePermission>> {
    if (!data.user_id || !data.page_key) {
      throw AppError.badRequest('Kullanıcı ID ve sayfa anahtarı zorunludur')
    }

    const validPageKeys = PAGES_REQUIRING_PERMISSION as readonly string[]
    if (!validPageKeys.includes(data.page_key)) {
      throw AppError.badRequest(`Geçersiz sayfa anahtarı: ${data.page_key}`)
    }

    const target = this.repository.findById(data.user_id)
    if (!target) throw AppError.notFound('Hedef kullanıcı bulunamadı')

    const grantor = this.repository.findById(data.granted_by)
    if (!grantor) throw AppError.notFound('Yetki veren kullanıcı bulunamadı')

    if (target.role === 'system') {
      throw AppError.forbidden('Sistem kullanıcısına sayfa kısıtlaması uygulanamaz')
    }
    if (grantor.role === 'user') {
      throw AppError.forbidden('User rolünde izin verme yetkiniz bulunmuyor')
    }
    if (grantor.role === 'admin' && target.role !== 'user') {
      throw AppError.forbidden('Admin sadece user rolündeki kullanıcılara izin verebilir')
    }

    if (grantor.role === 'system') {
      // system: herhangi bir geçerli sayfa atayabilir
    } else if (grantor.role === 'superadmin') {
      if (target.role !== 'admin' && target.role !== 'user') {
        throw AppError.forbidden('Superadmin sadece admin ve user rollerine sayfa atayabilir')
      }
      const allowed = new Set(
        this.repository
          .getRoleSystemDefaults(grantor.role)
          .filter((r) => r.can_access)
          .map((r) => r.page_key)
      )
      if (!allowed.has(data.page_key)) {
        throw AppError.forbidden(
          `Bu sayfa (${data.page_key}) size atanmamış; sadece system'ın size verdiği sayfaları atayabilirsiniz`
        )
      }
    } else if (grantor.role === 'admin') {
      const allowed = new Set(
        this.repository
          .getRoleSystemDefaults('admin')
          .filter((r) => r.can_access)
          .map((r) => r.page_key)
      )
      if (!allowed.has(data.page_key)) {
        throw AppError.forbidden(
          'Admin sadece kendine verilen sayfalar üzerinde açma/kısıtlama yapabilir'
        )
      }
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
    const permissionKeysSet = new Set(PAGES_REQUIRING_PERMISSION as readonly string[])
    const roleVisibilityDefaults = this.buildRoleVisibilityDefaultsForUser(user.role, permissionKeysSet)

    return this.ok(
      {
        user: response,
        permissions: [],
        role_visibility_defaults: roleVisibilityDefaults
      },
      'Kullanıcı bilgileri getirildi'
    )
  }

  /** Rol bazlı varsayılan sayfa setini getirir — sadece system çağırabilir. Sadece menüdeki sayfalar döner. */
  private async getRolePageDefaults(
    data: GetRolePageDefaultsRequest
  ): Promise<ServiceResponse<string[]>> {
    const role = data.role
    if (role !== 'superadmin' && role !== 'admin' && role !== 'user') {
      throw AppError.badRequest('Geçersiz rol; superadmin, admin veya user olmalı')
    }
    const fromDb = this.repository.getRolePageDefaults(role)
    const permissionKeysSet = new Set(PAGES_REQUIRING_PERMISSION as readonly string[])
    const pageKeys = fromDb.filter((k) => permissionKeysSet.has(k))
    return this.ok(pageKeys, 'Rol sayfa varsayılanları getirildi')
  }

  /** Rol bazlı varsayılan sayfa setini günceller — sadece system çağırabilir. */
  private async setRolePageDefaults(
    data: SetRolePageDefaultsRequest
  ): Promise<ServiceResponse<null>> {
    if (!data.role || data.page_keys === undefined || !data.set_by) {
      throw AppError.badRequest('Rol, sayfa anahtarları ve işlemi yapan kullanıcı zorunludur')
    }
    const actor = this.repository.findById(data.set_by)
    if (!actor) throw AppError.notFound('İşlemi yapan kullanıcı bulunamadı')
    if (actor.role !== 'system') {
      throw AppError.forbidden('Rol sayfa varsayılanları yalnızca sistem kullanıcısı tarafından ayarlanabilir')
    }
    const validPageKeys = PAGES_REQUIRING_PERMISSION as readonly string[]
    for (const key of data.page_keys) {
      if (!validPageKeys.includes(key)) {
        throw AppError.badRequest(`Geçersiz sayfa anahtarı: ${key}`)
      }
    }
    const role = data.role as 'superadmin' | 'admin' | 'user'
    this.repository.setRolePageDefaults(role, data.page_keys)
    this.repository.addAuditLog(
      data.set_by,
      'SET_ROLE_PAGE_DEFAULTS',
      `${role} rolü için ${data.page_keys.length} sayfa tanımlandı`
    )
    return this.ok(null, 'Rol sayfa varsayılanları güncellendi')
  }

  /**
   * Hedef role atanabilir sayfa anahtarlarını döndürür (UI için).
   * system: tüm sayfalar; superadmin: kendine verilen sayfalar; admin: kendine verilen sayfalar.
   */
  private async getAssignablePages(
    data: GetAssignablePagesRequest
  ): Promise<ServiceResponse<string[]>> {
    const actor = this.repository.findById(data.actor_id)
    if (!actor) throw AppError.notFound('İşlemi yapan kullanıcı bulunamadı')
    const target = this.repository.findById(data.target_user_id)
    if (!target) throw AppError.notFound('Hedef kullanıcı bulunamadı')

    if (target.role === 'system') {
      return this.ok([], 'Sistem kullanıcısına sayfa atanmaz')
    }
    if (actor.role === 'user') {
      throw AppError.forbidden('User rolü sayfa yönetimi yapamaz')
    }
    if (actor.role === 'admin' && target.role !== 'user') {
      throw AppError.forbidden('Admin sadece user rolündeki kullanıcılar için sayfa atayabilir')
    }

    const permissionKeysSet = new Set(PAGES_REQUIRING_PERMISSION as readonly string[])
    const assignable =
      actor.role === 'system'
        ? [...PAGES_REQUIRING_PERMISSION]
        : this.repository
            .getRoleSystemDefaults(actor.role)
            .filter((r) => r.can_access && permissionKeysSet.has(r.page_key))
            .map((r) => r.page_key)
    return this.ok(assignable, 'Atanabilir sayfalar getirildi')
  }

  /**
   * Hedef rol için listelenecek sayfa anahtarlarını döndürür (Sayfa Yönetimi UI).
   * Liste = system'ın hedef role verdiği default sayfalar (role_system_defaults(target_role)).
   * Örn: superadmin "admin" seçince sadece system'ın admin'e verdiği sayfalar (örn. Kullanıcı Yönetimi) listelenir.
   */
  private async getAssignablePagesForRole(
    data: GetAssignablePagesForRoleRequest
  ): Promise<ServiceResponse<string[]>> {
    const actor = this.repository.findById(data.actor_id)
    if (!actor) throw AppError.notFound('İşlemi yapan kullanıcı bulunamadı')

    if (actor.role === 'user') {
      throw AppError.forbidden('User rolü sayfa yönetimi yapamaz')
    }
    const targetRole = data.target_role
    if (actor.role === 'superadmin' && targetRole !== 'admin' && targetRole !== 'user') {
      throw AppError.badRequest('Superadmin sadece admin veya user rolü için atanabilir sayfa alabilir')
    }
    if (actor.role === 'admin' && targetRole !== 'user') {
      throw AppError.badRequest('Admin sadece user rolü için atanabilir sayfa alabilir')
    }

    const permissionKeysSet = new Set(PAGES_REQUIRING_PERMISSION as readonly string[])
    const list =
      actor.role === 'system'
        ? [...PAGES_REQUIRING_PERMISSION]
        : this.repository
            .getRoleSystemDefaults(targetRole)
            .filter((r) => r.can_access && permissionKeysSet.has(r.page_key))
            .map((r) => r.page_key)
    return this.ok(list, 'Hedef rol için listelenecek sayfalar getirildi')
  }

  /** Rol sayfa erişimini getirir (efektif: role_system_defaults + role_page_access override). */
  private async getRoleVisibilityDefaults(
    data: GetRoleVisibilityDefaultsRequest
  ): Promise<ServiceResponse<RoleVisibilityDefault[]>> {
    const role = data.role
    if (role !== 'superadmin' && role !== 'admin' && role !== 'user') {
      throw AppError.badRequest('Geçersiz rol; superadmin, admin veya user olmalı')
    }
    const permissionKeysSet = new Set(PAGES_REQUIRING_PERMISSION as readonly string[])
    const list = this.repository
      .getEffectiveRolePageAccess(role)
      .filter((r) => permissionKeysSet.has(r.page_key))
    return this.ok(list, 'Rol sayfa erişimi getirildi')
  }

  /**
   * Alt rol için sayfa erişimini günceller. Sadece hedef role system'ın verdiği sayfalar üzerinde aç/kapa yapılabilir.
   * Superadmin → admin veya user; admin → user. İzin verilen sayfalar = role_system_defaults(target_role).
   */
  private async setRoleVisibilityDefaults(
    data: SetRoleVisibilityDefaultsRequest
  ): Promise<ServiceResponse<null>> {
    if (!data.target_role || !data.defaults || !data.actor_id) {
      throw AppError.badRequest('Hedef rol, varsayılanlar ve işlemi yapan kullanıcı zorunludur')
    }
    const actor = this.repository.findById(data.actor_id)
    if (!actor) throw AppError.notFound('İşlemi yapan kullanıcı bulunamadı')

    const permissionKeysSet = new Set(PAGES_REQUIRING_PERMISSION as readonly string[])
    const targetRole = data.target_role as 'superadmin' | 'admin' | 'user'

    if (actor.role === 'superadmin') {
      if (targetRole !== 'admin' && targetRole !== 'user') {
        throw AppError.forbidden('Superadmin sadece admin ve user rollerine sayfa açıp kapatabilir')
      }
    } else if (actor.role === 'admin') {
      if (targetRole !== 'user') {
        throw AppError.forbidden('Admin sadece user rolüne sayfa açıp kapatabilir')
      }
    } else {
      throw AppError.forbidden('Bu işlem için yetkiniz yok')
    }

    const allowed = new Set(
      this.repository
        .getRoleSystemDefaults(targetRole)
        .filter((r) => r.can_access && permissionKeysSet.has(r.page_key))
        .map((r) => r.page_key)
    )
    const filtered = data.defaults.filter((d) => {
      if (!permissionKeysSet.has(d.page_key)) return false
      if (!allowed.has(d.page_key)) {
        throw AppError.forbidden(
          `Sayfa (${d.page_key}) hedef role system tarafından verilmediği için atanamaz`
        )
      }
      return true
    })

    this.repository.setRolePageAccess(targetRole, filtered, data.actor_id)
    this.repository.addAuditLog(
      data.actor_id,
      'SET_ROLE_PAGE_ACCESS',
      `${targetRole} rolü için ${filtered.length} sayfa güncellendi`
    )
    return this.ok(null, 'Rol sayfa erişimi güncellendi')
  }

  // ================================================================
  // YARDIMCILAR
  // ================================================================

  /**
   * Rol bazlı sayfa erişimi (efektif: role_system_defaults + role_page_access override).
   * system: boş (tüm sayfalara erişir); diğer roller: getEffectiveRolePageAccess.
   */
  private buildRoleVisibilityDefaultsForUser(
    role: User['role'],
    permissionKeysSet: Set<string>
  ): { page_key: string; can_access: boolean }[] {
    if (role === 'system') return []
    return this.repository
      .getEffectiveRolePageAccess(role)
      .filter((r) => permissionKeysSet.has(r.page_key))
  }

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
