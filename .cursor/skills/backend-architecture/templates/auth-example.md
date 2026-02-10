# Auth Modülü Referans Örneği

Bu dosya AuthService ve AuthRepository'nin güncel implementasyonunu referans olarak sunar. Yeni modüller bu kalıpları takip etmelidir.

## Rol Hiyerarşisi

```
system (4) > superadmin (3) > admin (2) > user (1)
```

- `system`: Seed ile oluşturulur, silinemez, tüm yetkiler. Arayüzden atanamaz.
- `superadmin`: Yalnızca system tarafından atanabilir. Admin ve user yönetir.
- `admin`: Sadece user yönetir, rol değiştiremez.
- `user`: Kimseyi yönetemez.

---

## AuthRepository — Gelişmiş Repository Kalıpları

### Çoklu Tablo Yönetimi

Bir repository birden fazla tablo yönetebilir. `getTableSchemas()` içinde tüm tablolar tanımlanır:

```typescript
protected getTableSchemas(): readonly string[] {
  return [
    `CREATE TABLE IF NOT EXISTS users (...)`,
    `CREATE TABLE IF NOT EXISTS page_permissions (...)`,
    `CREATE TABLE IF NOT EXISTS audit_logs (...)`,
    `CREATE TABLE IF NOT EXISTS role_system_defaults (...)`,
    `CREATE TABLE IF NOT EXISTS role_page_access (...)`
  ]
}
```

### Farklı Modellere Boolean Dönüşüm

Ana entity dışındaki modeller için `toBooleans<U>()` kullanılır:

```typescript
private readonly permissionBoolCols = ['can_access'] as const

getPermissionsByUserId(userId: number): PagePermission[] {
  return this.safeExecute(() => {
    const stmt = this.db.prepare(
      `SELECT * FROM page_permissions WHERE user_id = ? ORDER BY page_key`
    )
    const rows = stmt.all(userId) as Record<string, unknown>[]
    return rows.map((row) => this.toBooleans<PagePermission>(row, this.permissionBoolCols))
  })
}
```

### UPSERT Pattern

```typescript
upsertPermission(userId: number, pageKey: string, canAccess: boolean, grantedBy: number): PagePermission {
  return this.safeExecute(() => {
    const stmt = this.db.prepare(
      `INSERT INTO page_permissions (user_id, page_key, can_access, granted_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, page_key)
       DO UPDATE SET can_access = excluded.can_access, granted_by = excluded.granted_by`
    )
    stmt.run(userId, pageKey, canAccess ? 1 : 0, grantedBy)
    return this.getPermission(userId, pageKey) as PagePermission
  })
}
```

### Varlık Kontrolü (exists pattern)

```typescript
isTcKimlikNoTaken(tcKimlikNo: string, excludeId?: number): boolean {
  return this.safeExecute(() => {
    if (excludeId) {
      const stmt = this.db.prepare(
        `SELECT COUNT(*) as total FROM users WHERE tc_kimlik_no = ? AND id != ?`
      )
      return (stmt.get(tcKimlikNo, excludeId) as { total: number }).total > 0
    }
    const stmt = this.db.prepare(
      `SELECT COUNT(*) as total FROM users WHERE tc_kimlik_no = ?`
    )
    return (stmt.get(tcKimlikNo) as { total: number }).total > 0
  })
}
```

---

## AuthService — Gelişmiş Service Kalıpları

### CRUD Override ile Validasyon

```typescript
protected override async handleCreate(data: unknown): Promise<ServiceResponse<unknown>> {
  const input = data as CreateUserRequest & { created_by: number }

  // 1. Validasyon (TC Kimlik No + şifre kuralları)
  const tcTrim = input.tc_kimlik_no?.trim() ?? ''
  if (!isValidTcKimlikNo(tcTrim)) throw AppError.badRequest('TC Kimlik No 11 rakam olmalıdır')
  if (!input.password) throw AppError.badRequest('Şifre zorunludur')
  const pwdError = validatePassword(input.password)
  if (pwdError) throw AppError.badRequest(pwdError)

  // 2. İş kuralı kontrolü (system rolü atanamaz, rol hiyerarşisi)
  if (input.role === 'system') throw AppError.forbidden('Sistem rolü arayüz veya API ile atanamaz')
  this.validateRolePermission(input.created_by, input.role)

  if (this.repository.isTcKimlikNoTaken(tcTrim)) {
    throw AppError.conflict('Bu TC Kimlik No zaten kayıtlı')
  }

  // 3. Veri dönüşümü ve kayıt
  const user = this.repository.create({
    tc_kimlik_no: tcTrim,
    password: bcrypt.hashSync(input.password, SALT_ROUNDS),
    full_name: input.full_name.trim(),
    rutbe: (input.rutbe ?? '').trim(),
    role: input.role,
    is_active: true,
    must_change_password: true
  })

  // 4. Yanıt dönüşümü (şifre çıkar)
  const response = this.stripPassword(user)

  // 5. Audit log
  this.repository.addAuditLog(input.created_by, 'CREATE_USER', `${tcTrim} oluşturuldu (Rol: ${input.role})`)

  return this.created(response, 'Kullanıcı başarıyla oluşturuldu')
}
```

### Özel Handler Kalıbı

```typescript
protected override getCustomHandlers(): ServiceHandlerMap {
  return {
    'auth:login': (data) => this.login(data as LoginRequest),
    'auth:change-password': (data) => this.changePassword(data as ChangePasswordRequest),
    'auth:set-permission': (data) => this.setPermission(data as SetPermissionRequest),
    'auth:get-permissions': (data) => this.getPermissions(data as { user_id: number }),
    'auth:get-current-user': (data) => this.getCurrentUser(data as { user_id: number }),
    'auth:get-role-page-defaults': (data) => this.getRolePageDefaults(data as GetRolePageDefaultsRequest),
    'auth:set-role-page-defaults': (data) => this.setRolePageDefaults(data as SetRolePageDefaultsRequest),
    'auth:get-assignable-pages': (data) => this.getAssignablePages(data as GetAssignablePagesRequest),
    'auth:get-assignable-pages-for-role': (data) => this.getAssignablePagesForRole(data as GetAssignablePagesForRoleRequest),
    'auth:get-role-visibility-defaults': (data) => this.getRoleVisibilityDefaults(data as GetRoleVisibilityDefaultsRequest),
    'auth:set-role-visibility-defaults': (data) => this.setRoleVisibilityDefaults(data as SetRoleVisibilityDefaultsRequest)
  }
}
```

### Seed Data Pattern (System Kullanıcısı)

```typescript
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
```

### Rol Hiyerarşisi Kontrolü

```typescript
private validateRolePermission(actorId: number, targetRole: string): void {
  const actor = this.repository.findById(actorId)
  if (!actor) throw AppError.notFound('İşlemi yapan kullanıcı bulunamadı')

  const targetLevel = ROLE_HIERARCHY[targetRole as keyof typeof ROLE_HIERARCHY]
  if (targetLevel === undefined) throw AppError.badRequest(`Geçersiz rol: ${targetRole}`)

  // system her rolü atayabilir
  if (actor.role === 'system') return

  // superadmin rolü yalnızca system tarafından atanabilir
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
```

### Şifre Değiştirme (kendi vs. başkasının)

```typescript
// Kendi şifresi (user_id === changed_by): old_password zorunlu, doğrulanır
// Başkasının şifresi: yetkili kontrol + old_password yok + must_change_password = true
private async changePassword(data: ChangePasswordRequest): Promise<ServiceResponse<null>> {
  // ... validasyon ...
  const isSelf = data.user_id === data.changed_by

  if (isSelf) {
    // Mevcut şifre kontrolü + yeni şifre farklı olmalı
    this.repository.update(data.user_id, {
      password: bcrypt.hashSync(data.new_password, SALT_ROUNDS),
      must_change_password: false
    })
  } else {
    // Yetki kontrolü + şifre değiştirme + must_change_password = true
    this.repository.update(data.user_id, {
      password: bcrypt.hashSync(data.new_password, SALT_ROUNDS),
      must_change_password: true
    })
  }
  return this.ok(null, 'Şifre başarıyla değiştirildi')
}
```
