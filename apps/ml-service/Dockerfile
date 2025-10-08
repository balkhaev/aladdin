# syntax=docker/dockerfile:1.5

# Stage 1: Builder
FROM python:3.11-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install build dependencies and build TA-Lib from source
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        gcc \
        gfortran \
        libffi-dev \
        libopenblas-dev \
        libssl-dev; \
    rm -rf /var/lib/apt/lists/*; \
    curl -L -o /tmp/ta-lib.tar.gz https://github.com/TA-Lib/ta-lib/releases/download/v0.4.0/ta-lib-0.4.0-src.tar.gz; \
    mkdir -p /tmp/ta-lib-src; \
    tar -xzf /tmp/ta-lib.tar.gz -C /tmp/ta-lib-src --strip-components=1; \
    cd /tmp/ta-lib-src; \
    ./configure --prefix=/usr/local; \
    make -j"$(nproc)"; \
    make install; \
    ldconfig; \
    rm -rf /tmp/ta-lib-src /tmp/ta-lib.tar.gz

# Copy requirements and install dependencies
COPY apps/ml-service/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && \
    pip install --user --no-warn-script-location -r requirements.txt

# Stage 2: Runner
FROM python:3.11-slim AS runner

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH=/root/.local/bin:$PATH

WORKDIR /app

# Install only runtime dependencies
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        libopenblas0-pthread; \
    rm -rf /var/lib/apt/lists/*; \
    ldconfig

# Copy TA-Lib artifacts and Python packages from builder
COPY --from=builder /usr/local /usr/local
COPY --from=builder /root/.local /root/.local

# Copy application source
COPY apps/ml-service /app

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
