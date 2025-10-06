# Руководство администратора

## Обзор

Система поддерживает две роли пользователей:

- **user** - обычный пользователь (по умолчанию)
- **admin** - администратор с расширенными правами

## Возможности администратора

Администраторы имеют доступ к специальному разделу "Администрирование" в сайдбаре, который включает:

### Управление пользователями (`/admin/users`)

- Просмотр списка всех пользователей системы
- Изменение ролей пользователей (user ↔ admin)
- Удаление пользователей
- Просмотр статистики по каждому пользователю:
  - Количество портфелей
  - Количество ордеров
  - Количество подключенных бирж
  - Дата регистрации
  - Статус подтверждения email

## Назначение администратора

### Способ 1: Через скрипт (рекомендуется)

Используйте скрипт `make-admin.ts` для назначения пользователя администратором:

```bash
bun run scripts/make-admin.ts <email-пользователя>
```

Пример:

```bash
bun run scripts/make-admin.ts admin@example.com
```

Скрипт автоматически:

- Найдет пользователя по email
- Проверит текущую роль
- Изменит роль на admin
- Создаст запись в audit log

### Способ 2: Через базу данных

Если по каким-то причинам скрипт недоступен, можно изменить роль напрямую в базе данных:

```sql
UPDATE "user"
SET role = 'admin'
WHERE email = 'admin@example.com';
```

## API Endpoints

Все admin endpoints защищены middleware `adminMiddleware`, который проверяет наличие роли `admin`.

### GET /api/admin/users

Получить список всех пользователей.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "user_id",
      "name": "User Name",
      "email": "user@example.com",
      "emailVerified": true,
      "role": "user",
      "image": null,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z",
      "_count": {
        "portfolios": 2,
        "orders": 15,
        "exchangeCredentials": 1
      }
    }
  ],
  "timestamp": 1234567890
}
```

### GET /api/admin/users/:userId

Получить детальную информацию о пользователе.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "user",
    "_count": {
      "portfolios": 2,
      "orders": 15,
      "exchangeCredentials": 1,
      "sessions": 3,
      "auditLogs": 42
    },
    "portfolios": [...],
    "exchangeCredentials": [...]
  },
  "timestamp": 1234567890
}
```

### PATCH /api/admin/users/:userId/role

Изменить роль пользователя.

**Request:**

```json
{
  "role": "admin"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "admin",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "timestamp": 1234567890
}
```

### DELETE /api/admin/users/:userId

Удалить пользователя (cascade delete всех связанных данных).

**Важно:** Администратор не может удалить сам себя.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "deleted": true
  },
  "timestamp": 1234567890
}
```

## Безопасность

### Проверка прав

1. **Backend**: Middleware `adminMiddleware` проверяет роль пользователя в базе данных для каждого запроса к admin endpoints
2. **Frontend**: Раздел "Администрирование" отображается только для пользователей с ролью `admin`
3. **Routes**: Страница `/admin/users` проверяет роль перед отображением контента

### Audit Log

Все действия администратора логируются в таблицу `audit_logs`:

- Изменение роли пользователя
- Удаление пользователя

Запись включает:

- ID администратора, выполнившего действие
- Тип действия (UPDATE, DELETE)
- ID затронутого ресурса
- Детали изменений (old/new значения)
- Timestamp

## Миграции

Поле `role` было добавлено в модель `User` миграцией `20251006130159_add_user_role`:

```sql
ALTER TABLE "user" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
```

Все существующие пользователи автоматически получили роль `user`.

## Расширение функционала

Для добавления новых admin функций:

1. Создайте новый роутер в `apps/server/src/routers/`
2. Подключите роутер в `apps/server/src/index.ts` с middleware `adminMiddleware`
3. Создайте страницу в `apps/web/src/routes/_auth.admin.*.tsx`
4. Добавьте пункт меню в `apps/web/src/components/app-sidebar.tsx`
5. Обновите `PAGE_TITLES` в `apps/web/src/routes/_auth.tsx`

## Troubleshooting

### Пользователь не видит раздел "Администрирование"

1. Проверьте роль в базе данных:

```sql
SELECT id, email, role FROM "user" WHERE email = 'admin@example.com';
```

2. Убедитесь, что пользователь перелогинился после изменения роли
3. Проверьте, что типы Better-Auth правильно расширены (`apps/web/src/lib/auth-types.ts`)

### Ошибка 403 при доступе к admin endpoints

1. Проверьте, что пользователь аутентифицирован
2. Проверьте роль пользователя в базе данных
3. Проверьте логи gateway для деталей ошибки

### Не создается audit log

Проверьте, что в модели `AuditLog` правильно настроена связь с `User`:

```prisma
model AuditLog {
  id         String  @id @default(cuid())
  userId     String
  user       User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  action     String
  resource   String
  resourceId String?
  details    String?
  createdAt  DateTime @default(now())
  // ...
}
```
