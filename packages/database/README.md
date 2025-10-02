# @aladdin/database

Пакет для работы с PostgreSQL через Prisma ORM.

## Описание

Централизованный пакет, содержащий:

- Prisma схему базы данных
- Сгенерированный Prisma Client
- Миграции
- Конфигурацию Prisma

## Использование

```typescript
import { PrismaClient } from "@aladdin/database"

const prisma = new PrismaClient()

// Использование
const users = await prisma.user.findMany()
```

## Скрипты

- `bun db:generate` - генерация Prisma Client
- `bun db:push` - синхронизация схемы с БД
- `bun db:migrate` - создание и применение миграций
- `bun db:studio` - открыть Prisma Studio

## Структура

```
packages/database/
├── prisma/
│   ├── schema/
│   │   └── schema.prisma      # Prisma схема
│   ├── generated/              # Сгенерированный клиент
│   └── migrations/             # Миграции
├── prisma.config.ts            # Конфигурация Prisma
└── package.json
```

## Модели

### Auth (Better-Auth)

- **User** - пользователи
- **Session** - сессии
- **Account** - провайдеры аутентификации
- **Verification** - верификация email

### Trading

- **Portfolio** - портфели
- **Position** - позиции
- **Order** - ордера
- **ExchangeCredentials** - учетные данные бирж
- **AuditLog** - аудит действий

## Переменные окружения

```env
DATABASE_URL="postgresql://user:password@host:port/dbname"
```

## Зависимости

Используется в:

- `@aladdin/server` (API Gateway)
- `@aladdin/portfolio` (Portfolio Service)
- `@aladdin/trading` (Trading Service)
