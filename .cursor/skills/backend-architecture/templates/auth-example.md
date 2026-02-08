# Auth Modülü Referans Örneği

Bu dosya AuthService ve AuthRepository'nin tam implementasyonunu referans olarak sunar. Yeni modüller bu kalıpları takip etmelidir.

## AuthRepository — Gelişmiş Repository Kalıpları

### Çoklu Tablo Yönetimi

Bir repository birden fazla tablo yönetebilir. `getTableSchemas()` içinde tüm tablolar tanımlanır:

```typescript
protected getTableSchemas(): readonly string[] {
  return [
    `CREATE TABLE IF NOT EXISTS users (...)`,
    `CREATE TABLE IF NOT EXISTS page_permissions (...)`,
    `CREATE TABLE IF NOT EXISTS audit_logs (...)`
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
isUsernameTaken(username: string, excludeId?: number): boolean {
  return this.safeExecute(() => {
    if (excludeId) {
      const stmt = this.db.prepare(
        `SELECT COUNT(*) as total FROM users WHERE username = ? AND id != ?`
      )
      return (stmt.get(username, excludeId) as { total: number }).total > 0
    }
    const stmt = this.db.prepare(
      `SELECT COUNT(*) as total FROM users WHERE username = ?`
    )
    return (stmt.get(username) as { total: number }).total > 0
  })
}
```

---

## AuthService — Gelişmiş Service Kalıpları

### CRUD Override ile Validasyon

```typescript
protected override async handleCreate(data: unknown): Promise<ServiceResponse<unknown>> {
  const input = data as CreateUserRequest & { created_by: number }

  // 1. Validasyon
  if (!input.username?.trim()) throw AppError.badRequest('Kullanıcı adı zorunludur')
  if (!input.password) throw AppError.badRequest('Şifre zorunludur')

  // 2. İş kuralı kontrolü
  this.validateRolePermission(input.created_by, input.role)
  if (this.repository.isUsernameTaken(input.username.trim())) {
    throw AppError.conflict('Bu kullanıcı adı zaten kullanılıyor')
  }

  // 3. Veri dönüşümü ve kayıt
  const user = this.repository.create({
    username: input.username.trim(),
    password: bcrypt.hashSync(input.password, SALT_ROUNDS),
    full_name: input.full_name.trim(),
    role: input.role,
    is_active: true
  })

  // 4. Yanıt dönüşümü (şifre çıkar)
  const response = this.stripPassword(user)

  // 5. Audit log
  this.repository.addAuditLog(input.created_by, 'CREATE_USER', `${input.username} oluşturuldu`)

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
    'auth:get-current-user': (data) => this.getCurrentUser(data as { user_id: number })
  }
}
```

### Seed Data Pattern

```typescript
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
```

### Rol Hiyerarşisi Kontrolü

```typescript
private validateRolePermission(actorId: number, targetRole: string): void {
  const actor = this.repository.findById(actorId)
  if (!actor) throw AppError.notFound('İşlemi yapan kullanıcı bulunamadı')

  const actorLevel = ROLE_HIERARCHY[actor.role]
  const targetLevel = ROLE_HIERARCHY[targetRole as keyof typeof ROLE_HIERARCHY]

  if (targetLevel === undefined) throw AppError.badRequest(`Geçersiz rol: ${targetRole}`)
  if (actor.role !== 'superadmin' && targetLevel >= actorLevel) {
    throw AppError.forbidden(`${actor.role} rolü, ${targetRole} rolündeki kullanıcıları yönetemez`)
  }
}
```
