# syntax=docker/dockerfile:1

# Basis Debian (bukan Alpine) karena Prisma 5 memilih engine berdasarkan
# OpenSSL yang terdeteksi di image. Alpine hanya punya libssl.so.3 sehingga
# deteksi jatuh ke target OpenSSL 1.1 dan engine gagal dimuat saat runtime.
#
# `openssl` wajib dipasang di SEMUA stage: image node:*slim tidak menyertakan
# OpenSSL sama sekali, dan tanpa itu `prisma generate` memilih
# debian-openssl-1.1.x yang tidak bisa dibuka.
FROM node:20-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* disuntikkan ke client bundle saat `next build`,
# jadi nilainya HARUS diset lewat build-arg, bukan saat runtime.
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ARG NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=""
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=${NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}

# AUTH_SECRET sengaja TIDAK dipasang di sini: membakar kunci tanda tangan
# sesi ke layer image membuatnya bisa diambil dari image.
# Nilai aslinya hanya disuntikkan saat runtime via `docker run -e`.

# Prisma generate butuh var ini ada; tidak ada query saat build
# karena semua halaman DB memakai `force-dynamic`.
ARG DATABASE_URL="postgresql://raia:raia_password@postgres:5432/raia"
ENV DATABASE_URL=${DATABASE_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN if [ -f prisma/schema.prisma ]; then npx prisma generate; fi
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Debian memakai groupadd/useradd, bukan addgroup/adduser ala BusyBox.
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -s /bin/sh nextjs
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
# `next start` membaca config runtime (PWA, dsb.) — tanpa file ini config diabaikan.
COPY --from=builder /app/next.config.mjs ./next.config.mjs
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["npm", "start"]
