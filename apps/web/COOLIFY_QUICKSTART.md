# Coolify Quick Start

## Что было исправлено

✅ Nginx настроен для работы за reverse proxy (Traefik)
✅ Правильная обработка X-Forwarded-* headers
✅ Порт изменён на 80 (стандарт для Coolify)
✅ Добавлены debug endpoints и диагностический скрипт
✅ Health check для мониторинга

## Быстрый старт в Coolify

### 1. Push код в Git
```bash
git add .
git commit -m "feat: configure for Coolify deployment"
git push
```

### 2. В Coolify создайте приложение

**Settings:**
- **Source**: Your Git Repository
- **Dockerfile Location**: `apps/web/Dockerfile`
- **Build Context**: `.` (корень репо)
- **Port**: `80`

**Environment Variables:**
```env
API_PROXY_TARGET=http://gateway:3000
WS_PROXY_TARGET=http://gateway:3000
```

### 3. Deploy!

Нажмите Deploy и дождитесь завершения.

## Проверка после деплоя

### Test endpoints:
```bash
# Health check
curl https://your-domain.com/health
# Должен вернуть: ok

# Debug info
curl https://your-domain.com/debug
# Должен вернуть: Nginx is working...
```

### Если что-то не работает:

1. **Получите имя контейнера в Coolify** (обычно показано в UI)

2. **Запустите диагностику:**
   ```bash
   docker exec <container_name> sh /diagnose.sh
   ```

3. **Проверьте логи:**
   ```bash
   docker logs <container_name>
   ```

## Частые проблемы

### "Белый экран" или 404
- Проверьте что контейнер запущен: `docker ps | grep web`
- Проверьте наличие файлов: `docker exec <container> ls /usr/share/nginx/html`
- Смотрите браузер DevTools → Network → проверьте статус код

### 502 на /api
- Gateway сервис должен быть в той же Docker network
- Проверьте: `docker exec <container> env | grep API_PROXY_TARGET`

### Не грузятся assets
- Откройте DevTools → Network
- Проверьте путь к файлам (должны быть `/assets/...`)
- Смотрите Response Headers → должен быть `X-Debug-Path`

## Локальное тестирование

Перед деплоем можно протестировать локально:

```bash
# Build
docker build -f apps/web/Dockerfile -t coffee-web .

# Run
docker run -d --name test-web -p 8080:80 coffee-web

# Test
curl http://localhost:8080/health
open http://localhost:8080

# Cleanup
docker stop test-web && docker rm test-web
```

## Полная документация

См. `COOLIFY_DEPLOY.md` для детальной информации и расширенного troubleshooting.
