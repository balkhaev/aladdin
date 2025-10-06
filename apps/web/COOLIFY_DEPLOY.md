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

### Встроенная диагностика
В образ встроен скрипт диагностики. Запустите его в контейнере:
```bash
docker exec <container_name> sh /diagnose.sh
```

Это покажет:
- Список файлов в `/usr/share/nginx/html`
- Конфигурацию nginx
- Environment variables
- Проверку health endpoints

### Debug endpoints
- `/health` - проверка работоспособности (должен возвращать `ok`)
- `/debug` - информация о nginx конфигурации

### Контейнер не стартует
Проверьте логи:
```bash
docker logs <container_id>
```

Проверьте, что контейнер запущен:
```bash
docker ps | grep coffee-web
```

### Белый экран / Assets не загружаются

1. Проверьте, что build прошёл успешно:
```bash
docker exec <container> ls -la /usr/share/nginx/html
docker exec <container> ls -la /usr/share/nginx/html/assets
```

2. Проверьте nginx конфигурацию:
```bash
docker exec <container> nginx -t
docker exec <container> cat /etc/nginx/conf.d/default.conf
```

3. Проверьте X-Debug headers в браузере (DevTools → Network)

4. Проверьте nginx access логи:
```bash
docker exec <container> tail -f /var/log/nginx/access.log
```

### 502 Bad Gateway на /api или /ws
- Проверьте, что `gateway` сервис доступен из контейнера:
  ```bash
  docker exec <container> wget -O- http://gateway:3000/health
  ```
- Проверьте, что сервисы в одной Docker network в Coolify
- Проверьте environment variables:
  ```bash
  docker exec <container> env | grep PROXY
  ```

### WebSocket не работает
- Убедитесь, что Traefik правильно настроен для WebSocket
- Проверьте headers в браузере DevTools:
  - Request: `Upgrade: websocket`, `Connection: Upgrade`
  - Response: должен быть 101 Switching Protocols
- Проверьте nginx логи на ошибки upstream

### Проблемы с Coolify Traefik
Если используете кастомный домен, убедитесь что:
1. SSL сертификат валиден
2. В настройках Coolify правильно указан порт (80)
3. Traefik labels настроены корректно

Проверьте Traefik логи:
```bash
docker logs <traefik_container>
```
