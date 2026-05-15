# Stage 1: Build dependency builder
FROM python:3.11-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Production runner
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime PostgreSQL client libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY . .

# Run application under non-privileged system user for absolute container runtime security
RUN addgroup --system --gid 1001 appgroup
RUN adduser --system --uid 1002 --gid 1001 appuser
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8000

ENV PORT 8000
ENV HOST "0.0.0.0"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
