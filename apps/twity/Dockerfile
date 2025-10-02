FROM node:20-slim

# Install chrome dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gnupg ca-certificates fonts-liberation libasound2 libatk1.0-0 \
    libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 \
    libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
    libx11-6 libx11-xcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
    libxrandr2 libxshmfence1 libxss1 libxtst6 xvfb \
    chromium && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-cache

# Копируем исходники вовнутрь образа
COPY . .

# Сборка TypeScript -> dist
RUN npm run build

EXPOSE 8000
CMD ["node","dist/index.js"]

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium 
