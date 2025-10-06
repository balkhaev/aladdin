#!/bin/bash

# Diagnostic script for coffee-web deployment
# Usage: docker exec <container_name> sh /diagnose.sh

echo "=== Coffee Web Diagnostics ==="
echo

echo "1. Nginx version:"
nginx -v
echo

echo "2. Files in /usr/share/nginx/html:"
ls -lah /usr/share/nginx/html/
echo

echo "3. Assets directory:"
ls -lah /usr/share/nginx/html/assets/ 2>/dev/null || echo "No assets directory"
echo

echo "4. Nginx configuration test:"
nginx -t
echo

echo "5. Environment variables:"
echo "PORT=${PORT}"
echo "API_PROXY_TARGET=${API_PROXY_TARGET}"
echo "WS_PROXY_TARGET=${WS_PROXY_TARGET}"
echo "NGINX_RESOLVER=${NGINX_RESOLVER}"
echo

echo "6. Active nginx config:"
cat /etc/nginx/conf.d/default.conf
echo

echo "7. Check if nginx is running:"
ps aux | grep nginx
echo

echo "8. Test localhost:"
wget -O- http://localhost:${PORT}/health 2>&1
echo
wget -O- http://localhost:${PORT}/debug 2>&1
echo

echo "=== End of diagnostics ==="
