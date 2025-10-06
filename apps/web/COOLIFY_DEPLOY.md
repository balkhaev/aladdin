# Деплой Web приложения в Coolify

## Изменения для работы за reverse proxy

### 1. Nginx конфигурация
Обновлена `nginx.conf` для правильной работы за Traefik (reverse proxy Coolify):

- ✅ Добавлена обработка `X-Forwarded-*` headers
- ✅ Настроен `real_ip` для получения правильного IP клиента
- ✅ Использование `$http_host` вместо `$host`
- ✅ Прокидывание headers от Traefik к upstream сервисам

### 2. Docker порт
- Изменён с `3001` на `80` (стандарт для Coolify)
- Coolify автоматически пробросит внешний порт на внутренний 80

## Настройка в Coolify

### Environment Variables
В настройках приложения в Coolify укажите:

```bash
# Обязательные
API_PROXY_TARGET=http://gateway:3000
WS_PROXY_TARGET=http://gateway:3000

# Опциональные (по умолчанию уже установлены)
PORT=80
NGINX_RESOLVER=127.0.0.11
```

### Важно!
1. **Docker Network**: Убедитесь, что `gateway` сервис находится в той же Docker network
2. **Health Check**: Приложение имеет `/health` endpoint для проверки состояния
3. **Build Context**: При сборке нужен доступ к корню монорепозитория (для Prisma schema)

## Сборка и тестирование локально

```bash
# Из корня монорепозитория
docker build -f apps/web/Dockerfile -t coffee-web .

# Запуск с тестовыми параметрами
docker run -d \
  --name coffee-web \
  -p 8080:80 \
  -e API_PROXY_TARGET=http://host.docker.internal:3000 \
  -e WS_PROXY_TARGET=http://host.docker.internal:3000 \
  coffee-web

# Проверка health
curl http://localhost:8080/health
```

## Деплой в Coolify

### Вариант 1: Git Deploy
1. Пушим изменения в репозиторий
2. В Coolify добавляем новое приложение → From Git
3. Указываем путь к Dockerfile: `apps/web/Dockerfile`
4. Build context: корень репозитория
5. Настраиваем environment variables
6. Deploy!

### Вариант 2: Docker Registry
```bash
# Build и push в registry
docker build -f apps/web/Dockerfile -t ghcr.io/your-username/coffee-web:latest .
docker push ghcr.io/your-username/coffee-web:latest

# В Coolify: создать приложение из Docker Image
# Указать image: ghcr.io/your-username/coffee-web:latest
```

## Troubleshooting

### Контейнер не стартует
Проверьте логи:
```bash
docker logs <container_id>
```

### 502 Bad Gateway
- Проверьте, что `gateway` сервис доступен
- Проверьте DNS резолвинг внутри контейнера
- Убедитесь, что сервисы в одной Docker network

### Assets не загружаются
- Проверьте, что build прошёл успешно: `docker exec <container> ls /usr/share/nginx/html`
- Проверьте nginx логи: `docker logs <container>`

### WebSocket не работает
- Убедитесь, что Traefik правильно настроен для WebSocket
- Проверьте headers в браузере (должны быть Upgrade: websocket)
