# Coolify Deployment Guide

Этот проект разворачивается в Coolify как монорепозиторий. Для каждого сервиса подготовлены Nixpacks-конфиги прямо в его каталоге (`apps/<service>/nixpacks.toml`), поэтому в Coolify достаточно указать путь до сервиса и включить builder **Nixpacks**.

## 1. Предварительные требования
- Поднимите инфраструктурные сервисы (PostgreSQL, ClickHouse, Redis, NATS и т.д.) либо через Coolify, либо внешне. Значения соединений пропишите в переменных окружения.
- Скопируйте нужные значения из `.env.example` рядом с каждым сервисом. Для `packages/database/.env` держите в актуальном состоянии строку подключения к БД.
- Убедитесь, что репозиторий подключён к Coolify с доступом по SSH.

## 2. Сервисы монорепозитория
| Сервис | Каталог | Порт по умолчанию | Основная команда | Примечания |
| --- | --- | --- | --- | --- |
| Gateway | `apps/gateway` | 3000 | `bun run start` | Выполняется сборка (`bun run build`) перед стартом.
| Web | `apps/web` | 4173 (установите `PORT` при необходимости) | `bun run serve -- --host 0.0.0.0 --port $PORT` | Сначала собирает `vite build`.
| Market Data | `apps/market-data` | 3010 | `bun run start` | Нужны рабочие ссылки на ClickHouse и NATS.
| Trading | `apps/trading` | 3011 | `bun run start` | Использует Redis/NATS.
| Portfolio | `apps/portfolio` | 3012 | `bun run start` | Требует БД и Redis.
| Analytics | `apps/analytics` | 3014 | `bun run start` | Работает с ClickHouse.
| Screener | `apps/screener` | 3017 | `bun run start` | Прогоняет сканер, требует Market Data API.
| Scraper | `apps/scraper` | 3018 | `bun run start` | Подключение к соц. источникам.
| ML Service | `apps/ml-service` | 8000 | `uvicorn src.main:app --host 0.0.0.0 --port $PORT` | Тянет PyTorch/Optuna; добавлены системные библиотеки TA-Lib.

> При необходимости можно добавлять другие приложения из `apps/` по аналогии.

## 3. Создание приложения в Coolify
1. В Coolify нажмите **New Application** → **Git Repository**.
2. Выберите подключённый репозиторий и ветку (например, `main`).
3. В поле **Project Root** укажите путь к нужному сервису (`apps/gateway`, `apps/web` и т.д.).
4. В разделе **Builder** выберите **Nixpacks**; свои конфиги будут автоматически подхвачены из `nixpacks.toml`.
5. Порт из таблицы выше укажите в разделе **Ports**. Если проект ожидает конкретный порт, добавьте переменную окружения `PORT`.
6. Пропишите переменные окружения из `.env.example` (секция **Environment Variables**).
7. (Опционально) Настройте авто-deploy по push в `main`.
8. Сохраните и запустите деплой.

## 4. Дополнительные параметры
- **NODE_ENV** уже принудительно установлен в `production` во всех bun-сервисах.
- Для ML-сервиса в `nixpacks.toml` заранее подключены системные пакеты (`gcc`, `pkg-config`, `ta-lib` и т.д.), чтобы успешно собрался `TA-Lib`.
- Если билд ML-сервиса падает на установке `TA-Lib`, проверьте наличие пакета в Nixpkgs: можно переопределить список через переменную Coolify `NIXPACKS_EXTRA_PACKAGES`.
- Чтобы ускорить сборку фронтенда, добавьте кеш Bun (`.bun`) в раздел **Persistent Directories** — это позволит кэшировать зависимости.

## 5. Проверка после выката
- Gateway: `GET /health` на внешнем домене → 200 OK.
- Market Data, Trading и др.: проверка `GET /health` или `GET /metrics` (если реализовано).
- Web: откройте публичный URL, убедитесь, что бандл подхватывает API Gateway из переменной `VITE_API_URL`.
- ML-сервис: `GET /docs` должен отдавать OpenAPI с FastAPI.

При необходимости можно определить зависимости между приложениями в Coolify, чтобы сервисы запускались по порядку (например, сначала базы данных, затем Gateway, потом фронтенд). EOF
